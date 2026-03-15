"""Chat API routes — RAG-powered Q&A about video content."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import ChatMessage, TranscriptChunk, User, Video
from app.schemas.schemas import ChatMessageResponse, ChatRequest, ChatResponse
from app.services.credit_service import check_and_deduct

router = APIRouter()
settings = get_settings()


@router.post("/{video_id}", response_model=ChatResponse)
async def chat_with_video(
    video_id: UUID,
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a question about a video using RAG (vector search + LLM)."""
    # Verify video exists
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
        # Fallback: no embeddings yet, use raw transcript
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

    # Call LLM
    from app.services.ai_pipeline import _call_ai
    provider = settings.DEFAULT_AI_PROVIDER
    model = settings.DEFAULT_AI_MODEL
    
    try:
        answer = await _call_ai(provider, model, messages)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {e}")

    # Save messages to history
    db.add(ChatMessage(user_id=user.id, video_id=video_id, role="user", content=req.message))
    db.add(ChatMessage(user_id=user.id, video_id=video_id, role="assistant", content=answer))
    await db.flush()

    return ChatResponse(answer=answer, sources=sources)


@router.get("/{video_id}/history", response_model=list[ChatMessageResponse])
async def get_chat_history(
    video_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Get chat history for a video."""
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
                   embedding <=> :embedding::vector AS distance
            FROM transcript_chunks
            WHERE video_id = :video_id AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding::vector
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
