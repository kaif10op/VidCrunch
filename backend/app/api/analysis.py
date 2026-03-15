"""Analysis API routes — get analysis results, list history."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Analysis, Transcript, User, Video
from app.schemas.schemas import AnalysisDetailResponse, AnalysisResponse, MessageResponse

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

    # Get transcript text
    transcript_text = None
    transcript_result = await db.execute(
        select(Transcript).where(Transcript.video_id == analysis.video_id)
    )
    transcript = transcript_result.scalar_one_or_none()
    if transcript:
        transcript_text = transcript.full_text

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
        select(Analysis.status, Analysis.error_message).where(
            Analysis.id == analysis_id, Analysis.user_id == user.id
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {"status": row.status, "error": row.error_message}
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
