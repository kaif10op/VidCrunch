"""Analysis API routes — get analysis results, list history."""

from uuid import UUID
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Analysis, Transcript, User, Video
from app.schemas.schemas import AnalysisDetailResponse, AnalysisResponse, MessageResponse, VideoResponse
from app.services.ai_pipeline import synthesize_content

router = APIRouter()


@router.get("/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific analysis with video info and transcript."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Get video
    video_result = await db.execute(select(Video).where(Video.id == analysis.video_id))
    video = video_result.scalar_one_or_none()

    transcript_text = None
    transcript_segments = None
    transcript_result = await db.execute(
        select(Transcript).where(Transcript.video_id == analysis.video_id)
    )
    transcript = transcript_result.scalar_one_or_none()
    if transcript:
        transcript_text = transcript.full_text
        transcript_segments = transcript.timestamps_json

    # Map extra fields
    resp = AnalysisResponse.model_validate(analysis)
    if video:
        resp.video_title = video.title
        resp.video_thumbnail = video.thumbnail_url
        resp.video_platform_id = video.platform_id

    return AnalysisDetailResponse(
        analysis=resp,
        video=video,
        transcript_text=transcript_text,
        transcript_segments=transcript_segments,
    )


@router.get("/", response_model=list[AnalysisResponse])
async def list_analyses(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    """List all analyses for the current user (history)."""
    # Join with Video to get titles in the list
    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(Analysis)
        .options(joinedload(Analysis.video))
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    analyses = result.scalars().all()
    
    # Map video details into the response
    responses = []
    for a in analyses:
        resp = AnalysisResponse.model_validate(a)
        if a.video:
            resp.video_title = a.video.title
            resp.video_thumbnail = a.video.thumbnail_url
            resp.video_platform_id = a.video.platform_id
        responses.append(resp)
        
    return responses


@router.get("/{analysis_id}/status")
async def get_analysis_status(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll analysis status (for frontend progress tracking)."""
    result = await db.execute(
        select(
            Analysis.status, 
            Analysis.error_message,
            Analysis.progress_percentage,
            Analysis.estimated_remaining_seconds
        ).where(
            Analysis.id == analysis_id, Analysis.user_id == user.id
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "status": row.status, 
        "error": row.error_message,
        "progress_percentage": row.progress_percentage,
        "estimated_remaining_seconds": row.estimated_remaining_seconds
    }
@router.delete("/{analysis_id}", response_model=MessageResponse)
async def delete_analysis(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific analysis (remove from history)."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.delete(analysis)
    await db.commit()
    return MessageResponse(message="Analysis deleted")


@router.post("/{analysis_id}/generate", response_model=AnalysisResponse)
async def generate_tool(
    analysis_id: UUID,
    tool_type: str = Query(..., pattern="^(overview|key_points|tags|quiz|roadmap|mind_map|flashcards|takeaways|learning_context|podcast)$"),
    append: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a specific tool for an existing analysis on demand."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # If tool already exists and not appending, just return it
    existing_value = getattr(analysis, tool_type)
    if existing_value is not None and not append:
        return AnalysisResponse.model_validate(analysis)

    existing_context = None
    if append and existing_value:
        if isinstance(existing_value, list):
            # For lists like quiz/flashcards, provide context to avoid duplicates
            existing_context = json.dumps(existing_value[:20]) # Limit context size

    # Need transcript
    from app.models.models import Transcript
    transcript_result = await db.execute(
        select(Transcript).where(Transcript.video_id == analysis.video_id)
    )
    transcript = transcript_result.scalar_one_or_none()
    if not transcript or not transcript.full_text:
         raise HTTPException(status_code=400, detail="Transcript missing for generation")

    # Get video metadata for context
    video_result = await db.execute(select(Video).where(Video.id == analysis.video_id))
    video = video_result.scalar_one_or_none()
    metadata = {
        "title": video.title if video else "Unknown",
        "channel": video.channel if video else "Unknown"
    }

    # Call targeted synthesis for ONLY this tool
    ai_result = await synthesize_content(
        transcript_text=transcript.full_text,
        metadata=metadata,
        expertise=analysis.expertise_level,
        style=analysis.style,
        minimal_mode=False,
        tools=[tool_type],
        existing_data=existing_context,
    )

    # Update analysis with the new tool
    if tool_type in ai_result:
        new_value = ai_result[tool_type]
        if append and existing_value is not None:
            if isinstance(existing_value, list) and isinstance(new_value, list):
                # Append to existing list
                setattr(analysis, tool_type, existing_value + new_value)
            elif isinstance(existing_value, dict) and isinstance(new_value, dict):
                # Merge dicts (less common but supported)
                setattr(analysis, tool_type, {**existing_value, **new_value})
            else:
                setattr(analysis, tool_type, new_value)
        else:
            setattr(analysis, tool_type, new_value)
            
        await db.commit()
        await db.refresh(analysis)
    else:
        # If the requested tool wasn't in the targeted synthesis
        raise HTTPException(status_code=500, detail=f"Failed to generate {tool_type}. AI returned: {list(ai_result.keys())}")

    return AnalysisResponse.model_validate(analysis)


@router.delete("/", response_model=MessageResponse)
async def clear_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all analyses for the current user."""
    from sqlalchemy import delete
    await db.execute(delete(Analysis).where(Analysis.user_id == user.id))
    await db.commit()
    return MessageResponse(message="History cleared")
