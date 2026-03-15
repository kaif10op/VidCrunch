"""Chat API routes — RAG-powered Q&A about video content."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Analysis, ChatMessage, TranscriptChunk, User, Video
from app.schemas.schemas import ChatMessageResponse, ChatRequest, ChatResponse
from app.services.credit_service import check_and_deduct

router = APIRouter()
settings = get_settings()


from fastapi.responses import StreamingResponse
import json

@router.post("/{analysis_id}", response_model=ChatResponse)
async def chat_with_video(
    analysis_id: UUID,
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a question about a video using streaming RAG (vector search + LLM)."""
    # Verify analysis and get video_id
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    video_id = analysis.video_id
    video_result = await db.execute(select(Video).where(Video.id == video_id))
    video = video_result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Deduct credits
    await check_and_deduct(db, user.id, settings.CREDIT_COST_CHAT, "chat", str(video_id))

    # Get embedding for the question
    question_embedding = await _get_embedding(req.message)

    # Vector search for relevant chunks
    relevant_chunks = await _search_chunks(db, video_id, question_embedding, top_k=5)

    if not relevant_chunks:
        from app.models.models import Transcript
        t_result = await db.execute(select(Transcript).where(Transcript.video_id == video_id))
        transcript = t_result.scalar_one_or_none()
        context = transcript.full_text[:8000] if transcript else "No transcript available."
        sources = []
    else:
        context = "\n\n".join([c["text"] for c in relevant_chunks])
        sources = [{"chunk_index": c["chunk_index"], "text": c["text"][:200]} for c in relevant_chunks]

    # Get recent chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.video_id == video_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
    )
    history = list(reversed(history_result.scalars().all()))

    # Build LLM messages
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert AI tutor. Answer questions based PRIMARILY on the video content below. "
                "If a timestamp is relevant, mention it like [2:45]. "
                "If the question isn't about the video, note that it's a general answer.\n\n"
                f"VIDEO CONTEXT:\n{context}"
            ),
        },
    ]
    for h in history:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    from app.services.ai_pipeline import _stream_ai_with_fallback
    provider = settings.DEFAULT_AI_PROVIDER
    model = settings.DEFAULT_AI_MODEL

    async def event_generator():
        full_answer = []
        # First event: source information
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        
        async for chunk in _stream_ai_with_fallback(provider, model, messages):
            full_answer.append(chunk)
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        
        # Save to history at the end
        final_answer = "".join(full_answer)
        # Note: We create a new session here or pass it if possible, but since we are in a generator
        # it's safer to use a background task or just fire and forget if the session is still alive.
        # For simplicity in this implementation, we'll assume the user message is saved beforehand.
        db.add(ChatMessage(user_id=user.id, video_id=video_id, role="user", content=req.message))
        db.add(ChatMessage(user_id=user.id, video_id=video_id, role="assistant", content=final_answer))
        await db.commit()
        
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{analysis_id}/history", response_model=list[ChatMessageResponse])
async def get_chat_history(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Get chat history for an analysis."""
    # Get video_id from analysis first
    result = await db.execute(
        select(Analysis.video_id).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    video_id = result.scalar_one_or_none()
    if not video_id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.video_id == video_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


async def _get_embedding(text: str) -> list[float]:
    """Generate embedding for text using the configured provider."""
    # We should use the centralized generate_embeddings from ai_pipeline
    from app.services.ai_pipeline import generate_embeddings
    
    try:
        embeddings = await generate_embeddings([text])
        if embeddings and len(embeddings) > 0:
            return embeddings[0]
    except Exception:
        pass
        
    # Fallback to zero vector
    return [0.0] * settings.EMBEDDING_DIMENSION


async def _search_chunks(
    db: AsyncSession, video_id: UUID, embedding: list[float], top_k: int = 5
) -> list[dict]:
    """Search transcript chunks by vector similarity."""
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    result = await db.execute(
        text("""
            SELECT id, chunk_index, text, start_time, end_time,
                   embedding <=> CAST(:embedding AS vector) AS distance
            FROM transcript_chunks
            WHERE video_id = :video_id AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """),
        {"video_id": str(video_id), "embedding": embedding_str, "top_k": top_k},
    )

    return [
        {
            "id": str(row.id),
            "chunk_index": row.chunk_index,
            "text": row.text,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "distance": row.distance,
        }
        for row in result.fetchall()
    ]
