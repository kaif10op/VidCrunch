"""Spaces API routes — create, list, add/remove videos."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, distinct, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Space, SpaceVideo, SpaceDocument, Note, User, Video, Document, Analysis, TranscriptChunk, DocumentChunk
from app.schemas.schemas import (
    MessageResponse,
    SpaceAddVideoRequest,
    SpaceCreateRequest,
    SpaceUpdateRequest,
    SpaceResponse,
    VideoResponse,
    DocumentResponse,
    NoteResponse,
    NoteCreateRequest,
    ChatRequest,
)

router = APIRouter()


@router.post("/", response_model=SpaceResponse)
async def create_space(
    req: SpaceCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    space = Space(user_id=user.id, name=req.name, description=req.description)
    db.add(space)
    await db.flush()
    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_public=space.is_public,
        video_count=0,
        document_count=0,
        note_count=0,
        created_at=space.created_at,
    )


@router.get("/", response_model=list[SpaceResponse])
async def list_spaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Fetch spaces with basic info
    result = await db.execute(
        select(Space)
        .where(Space.user_id == user.id)
        .order_by(Space.created_at.desc())
        .options(
            selectinload(Space.space_videos).joinedload(SpaceVideo.video),
            selectinload(Space.space_documents),
            selectinload(Space.space_notes)
        )
    )
    spaces = result.scalars().all()

    # 2. Return mapped response
    return [
        SpaceResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            is_public=s.is_public,
            video_count=len(s.space_videos),
            document_count=len(s.space_documents),
            note_count=len(s.space_notes),
            video_ids=[
                (sv.video.platform_id if sv.video and sv.video.platform_id else str(sv.video_id))
                for sv in s.space_videos
            ],
            created_at=s.created_at,
        )
        for s in spaces
    ]


@router.get("/{space_id}/videos", response_model=list[VideoResponse])
async def get_space_videos(
    space_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        id_uuid = UUID(space_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Space not found")

    # Verify ownership
    space_result = await db.execute(
        select(Space).where(Space.id == id_uuid, Space.user_id == user.id)
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    result = await db.execute(
        select(Video)
        .join(SpaceVideo, SpaceVideo.video_id == Video.id)
        .where(SpaceVideo.space_id == id_uuid)
        .order_by(SpaceVideo.added_at.desc())
    )
    videos = result.scalars().all()
    return videos


@router.post("/{space_id}/videos", response_model=MessageResponse)
async def add_video_to_space(
    space_id: str,
    req: SpaceAddVideoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        id_uuid = UUID(space_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Space not found")

    # Verify ownership
    space_result = await db.execute(
        select(Space).where(Space.id == id_uuid, Space.user_id == user.id)
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    # Resolve video_id
    video_db_id = None
    try:
        video_db_id = UUID(req.video_id)
    except ValueError:
        # Not a UUID, try searching by platform_id
        video_result = await db.execute(
            select(Video.id).where(Video.platform_id == req.video_id)
        )
        video_db_id = video_result.scalar_one_or_none()
        
    if not video_db_id:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check duplicate
    existing = await db.execute(
        select(SpaceVideo).where(
            SpaceVideo.space_id == id_uuid, SpaceVideo.video_id == video_db_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Video already in space")

    db.add(SpaceVideo(space_id=id_uuid, video_id=video_db_id))
    await db.commit()
    return MessageResponse(message="Video added to space")


@router.delete("/{space_id}/videos/{video_id}", response_model=MessageResponse)
async def remove_video_from_space(
    space_id: str,
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a video from a space. Supports Video ID, Analysis ID, or Platform ID."""
    try:
        id_uuid = UUID(space_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Space not found")

    # Verify ownership
    space_result = await db.execute(
        select(Space).where(Space.id == id_uuid, Space.user_id == user.id)
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    # Robust video_id resolution
    video_db_id = None
    try:
        potential_uuid = UUID(video_id)
        # 1. Check if it's a direct Video ID
        v_res = await db.scalar(select(Video.id).where(Video.id == potential_uuid))
        if v_res:
            video_db_id = v_res
        else:
            # 2. Check if it's an Analysis ID (common for history items)
            a_res = await db.scalar(select(Analysis.video_id).where(Analysis.id == potential_uuid))
            if a_res:
                video_db_id = a_res
    except ValueError:
        pass

    # 3. Try platform_id search (YouTube ID)
    if not video_db_id:
        v_res = await db.scalar(select(Video.id).where(Video.platform_id == video_id))
        video_db_id = v_res

    if not video_db_id:
        raise HTTPException(status_code=404, detail=f"Target video '{video_id}' not found")

    # Find the link
    link_res = await db.execute(
        select(SpaceVideo).where(
            SpaceVideo.space_id == id_uuid, 
            SpaceVideo.video_id == video_db_id
        )
    )
    sv = link_res.scalar_one_or_none()
    if not sv:
        # One last fallback: Maybe we passed the SpaceVideo primary key itself?
        try:
            potential_uuid = UUID(video_id)
            sv_res = await db.execute(select(SpaceVideo).where(SpaceVideo.id == potential_uuid))
            sv = sv_res.scalar_one_or_none()
        except ValueError:
            pass
            
    if not sv:
        raise HTTPException(status_code=404, detail="Video relation not found in this space")

    await db.delete(sv)
    await db.commit()
    return MessageResponse(message="Video removed from space")


@router.patch("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: str,
    req: SpaceUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update space details (e.g., rename)."""
    try:
        id_uuid = UUID(space_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Space not found")

    result = await db.execute(
        select(Space).where(Space.id == id_uuid, Space.user_id == user.id)
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    if req.name is not None:
        space.name = req.name
    if req.description is not None:
        space.description = req.description

    await db.commit()
    await db.refresh(space)

    # Re-fetch with fresh counts & relations
    res_counts = await db.execute(
        select(
            func.count(distinct(SpaceVideo.id)).label("v"),
            func.count(distinct(SpaceDocument.id)).label("d"),
            func.count(distinct(Note.id)).label("n")
        )
        .outerjoin(SpaceVideo, SpaceVideo.space_id == space.id)
        .outerjoin(SpaceDocument, SpaceDocument.space_id == space.id)
        .outerjoin(Note, Note.space_id == space.id)
        .where(Space.id == space.id)
        .group_by(Space.id)
    )
    counts = res_counts.one_or_none()
    v_count, d_count, n_count = counts if counts else (0,0,0)

    # Reload videos for the response
    res_vids = await db.execute(
        select(Video.platform_id, Video.id)
        .join(SpaceVideo, SpaceVideo.video_id == Video.id)
        .where(SpaceVideo.space_id == space.id)
    )
    v_ids = [ (row.platform_id or str(row.id)) for row in res_vids.all() ]

    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_public=space.is_public,
        video_count=v_count,
        document_count=d_count,
        note_count=n_count,
        video_ids=v_ids,
        created_at=space.created_at,
    )


@router.delete("/{space_id}", response_model=MessageResponse)
async def delete_space(
    space_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        id_uuid = UUID(space_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Space not found")

    result = await db.execute(
        select(Space).where(Space.id == id_uuid, Space.user_id == user.id)
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # 1. Clean up materials explicitly (even with cascade orphan delete)
    await db.execute(text("DELETE FROM space_videos WHERE space_id = :sid"), {"sid": id_uuid})
    await db.execute(text("DELETE FROM space_documents WHERE space_id = :sid"), {"sid": id_uuid})
    await db.execute(text("DELETE FROM notes WHERE space_id = :sid"), {"sid": id_uuid})
    await db.execute(text("DELETE FROM chat_messages WHERE space_id = :sid"), {"sid": id_uuid})

    # 2. Finally delete space
    await db.delete(space)
    await db.commit()
    return MessageResponse(message="Space deleted successfully")

# ──────────────────────────────────────────────
# NEW MATERIAL ENDPOINTS
# ──────────────────────────────────────────────

@router.get("/{space_id}/documents", response_model=list[DocumentResponse])
async def get_space_documents(
    space_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List documents in a space."""
    # Verify ownership
    space_result = await db.execute(
        select(Space).where(Space.id == space_id, Space.user_id == user.id)
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    result = await db.execute(
        select(Document)
        .join(SpaceDocument, SpaceDocument.document_id == Document.id)
        .where(SpaceDocument.space_id == space_id)
        .order_by(SpaceDocument.added_at.desc())
    )
    return result.scalars().all()

@router.post("/{space_id}/documents/{doc_id}", response_model=MessageResponse)
async def add_document_to_space(
    space_id: UUID,
    doc_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link an existing document to a space."""
    # Verify space ownership
    space_result = await db.execute(
        select(Space).where(Space.id == space_id, Space.user_id == user.id)
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    # Verify document ownership
    doc_result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user.id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    # Check duplicate
    existing = await db.execute(
        select(SpaceDocument).where(
            SpaceDocument.space_id == space_id, SpaceDocument.document_id == doc_id
        )
    )
    if existing.scalar_one_or_none():
        return MessageResponse(message="Document already in space")

    db.add(SpaceDocument(space_id=space_id, document_id=doc_id))
    await db.commit()
    return MessageResponse(message="Document added to space")

@router.delete("/{space_id}/documents/{doc_id}", response_model=MessageResponse)
async def remove_document_from_space(
    space_id: UUID,
    doc_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a document from a space."""
    # Verify ownership
    space_check = await db.execute(
        select(Space.id).where(Space.id == space_id, Space.user_id == user.id)
    )
    if not space_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    result = await db.execute(
        select(SpaceDocument).where(
            SpaceDocument.space_id == space_id, SpaceDocument.document_id == doc_id
        )
    )
    sd = result.scalar_one_or_none()
    if not sd:
        raise HTTPException(status_code=404, detail="Document not in space")

    await db.delete(sd)
    await db.commit()
    return MessageResponse(message="Document removed from space")

@router.get("/{space_id}/notes", response_model=list[NoteResponse])
async def get_space_notes(
    space_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notes in a space."""
    result = await db.execute(
        select(Note).where(Note.space_id == space_id, Note.user_id == user.id)
    )
    return result.scalars().all()

@router.post("/{space_id}/notes", response_model=NoteResponse)
async def create_note_in_space(
    space_id: UUID,
    req: NoteCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new note within a space."""
    # Verify ownership
    space_check = await db.execute(
        select(Space.id).where(Space.id == space_id, Space.user_id == user.id)
    )
    if not space_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Space not found")

    note = Note(
        user_id=user.id,
        space_id=space_id,
        title=req.title,
        content=req.content
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

@router.patch("/{space_id}/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    space_id: UUID,
    note_id: UUID,
    req: NoteCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a note in a space."""
    result = await db.execute(
        select(Note).where(
            Note.id == note_id, Note.space_id == space_id, Note.user_id == user.id
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if req.title is not None:
        note.title = req.title
    if req.content is not None:
        note.content = req.content

    await db.commit()
    await db.refresh(note)
    return note

@router.delete("/{space_id}/notes/{note_id}", response_model=MessageResponse)
async def delete_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a note from a space."""
    result = await db.execute(
        select(Note).where(
            Note.id == note_id, Note.space_id == space_id, Note.user_id == user.id
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.commit()
    return MessageResponse(message="Note deleted")


# ──────────────────────────────────────────────
# UNIFIED SPACE CHAT
# ──────────────────────────────────────────────

@router.post("/{space_id}/chat")
async def chat_with_space(
    space_id: UUID,
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified chat that searches across all videos and documents in the space."""
    from fastapi.responses import StreamingResponse
    from app.api.chat import _get_embedding, _search_chunks, _build_system_prompt, _build_messages
    import json
    import logging
    from app.models.models import ChatMessage
    from app.config import get_settings
    from app.services.ai_pipeline import _stream_ai_with_fallback
    
    settings = get_settings()
    logger = logging.getLogger(__name__)

    # 1. Verify space and get all materials
    space_result = await db.execute(select(Space).where(Space.id == space_id, Space.user_id == user.id))
    space = space_result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # 2. Build multi-source context
    # Get analysis results (Genius insights)
    analysis_result = await db.execute(
        select(Analysis)
        .join(SpaceVideo, SpaceVideo.video_id == Analysis.video_id)
        .where(SpaceVideo.space_id == space_id, Analysis.user_id == user.id)
        .distinct()
    )
    analyses = analysis_result.scalars().all()
    
    genius_context = "## GENIUS INSIGHTS (Video Summaries & Tools):\n"
    for a in analyses:
        genius_context += f"### Video: {a.video_id}\n"
        genius_context += f"OVERVIEW: {a.overview}\n"
        if a.key_points: genius_context += f"KEY POINTS: {json.dumps(a.key_points)}\n"
        if a.takeaways: genius_context += f"TAKEAWAYS: {json.dumps(a.takeaways)}\n"
        if a.mind_map: genius_context += f"MIND MAP NODES: {json.dumps([n.get('label') for n in a.mind_map.get('nodes', [])])}\n"
        if a.roadmap: genius_context += f"LEARNING ROADMAP: {json.dumps(a.roadmap.get('steps', []))}\n"
        if a.glossary: genius_context += f"GLOSSARY: {json.dumps(a.glossary)}\n"

    # Get notes
    notes_result = await db.execute(select(Note).where(Note.space_id == space_id))
    notes = notes_result.scalars().all()
    notes_context = "## USER NOTES:\n" + "\n".join([f"- {n.title}: {n.content}" for n in notes])

    # Search chunks (Video + Document)
    query_embedding = await _get_embedding(req.message)
    
    # Search video chunks
    video_ids = [sv.video_id for sv in space.space_videos]
    v_chunks = []
    if video_ids:
        # Simple loop for search across multiple videos (could be optimized)
        for vid in video_ids:
            v_chunks.extend(await _search_chunks(db, vid, query_embedding, top_k=3))
            
    # Search document chunks
    document_ids = [sd.document_id for sd in space.space_documents]
    d_chunks = []
    if document_ids:
        for did in document_ids:
            # We need a doc search helper (similar to _search_chunks but for DocumentChunk)
            # For now let's use a simpler inline query
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
            res = await db.execute(
                text("""
                    SELECT id, chunk_index, text,
                           embedding <=> CAST(:embedding AS vector) AS distance
                    FROM document_chunks
                    WHERE document_id = :document_id AND embedding IS NOT NULL
                    ORDER BY embedding <=> CAST(:embedding AS vector)
                    LIMIT 3
                """),
                {"document_id": str(did), "embedding": embedding_str},
            )
            rows = res.fetchall()
            d_chunks.extend([{"text": row.text, "type": "document", "id": str(row.id)} for row in rows if row.distance < 0.85])

    context = f"{genius_context}\n\n{notes_context}\n\n## TRANSCRIPT & DOCUMENT SNIPPETS:\n"
    context += "\n".join([c.get("text", "") for c in v_chunks]) + "\n"
    context += "\n".join([c.get("text", "") for c in d_chunks])

    # 3. Build system prompt & messages
    mission = (
        f"You are assisting the user in their learning space '{space.name}'. "
        "You have access to summaries of all videos, user notes, and relevant snippets from transcripts and documents. "
        "Always use RICH MARKDOWN (headings, bold, lists, tables) to structure your responses. "
        "When explaining complex connections or data, use specialized visual blocks if appropriate:\n"
        "- [VISUAL:MindMap] { \"nodes\": [...], \"edges\": [...] } [/VISUAL] for hierarchical concepts.\n"
        "- [VISUAL:Chart] { \"type\": \"bar|line\", \"title\": \"...\", \"data\": [{\"name\": \"...\", \"value\": 0}, ...] } [/VISUAL] for data comparisons.\n"
        "Synthesize information across ALL materials to provide the best learning experience."
    )
    system_prompt = _build_system_prompt(context, "synthesis", mission)
    
    # History
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.space_id == space_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
    )
    history = list(reversed(history_result.scalars().all()))
    
    messages = _build_messages(system_prompt, history, req.message)

    async def event_generator():
        full_answer = []
        async for chunk in _stream_ai_with_fallback(settings.DEFAULT_AI_PROVIDER, settings.DEFAULT_AI_MODEL, messages):
            full_answer.append(chunk)
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        
        # Persist
        db.add(ChatMessage(user_id=user.id, space_id=space_id, role="user", content=req.message))
        db.add(ChatMessage(user_id=user.id, space_id=space_id, role="assistant", content="".join(full_answer)))
        await db.commit()
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
