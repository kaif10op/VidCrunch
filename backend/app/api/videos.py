"""Video API routes — analyze URLs, upload files, get video details."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Analysis, User, Video
from app.schemas.schemas import (
    VideoAnalyzeRequest,
    VideoResponse,
    VideoUploadResponse,
    AnalysisDetailResponse,
    AnalysisResponse,
    MessageResponse,
)
from app.services.credit_service import check_and_deduct

router = APIRouter()
settings = get_settings()


@router.post("/analyze", response_model=MessageResponse)
async def analyze_videos(
    req: VideoAnalyzeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit video URLs for analysis. Returns immediately; processing happens in background."""
    # Determine credit cost
    cost = settings.CREDIT_COST_VIDEO_ANALYSIS
    if len(req.urls) > 1:
        cost = settings.CREDIT_COST_PLAYLIST

    # Check and deduct credits
    await check_and_deduct(db, user.id, cost, "video_analysis")

    # Create video records
    video_ids = []
    for url in req.urls:
        # Detect platform and extract ID
        platform, platform_id = _detect_platform(url)

        # Check if video already exists
        if platform_id:
            result = await db.execute(
                select(Video).where(
                    Video.platform == platform, Video.platform_id == platform_id
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                video_ids.append(str(existing.id))
                continue

        video = Video(
            platform=platform,
            platform_id=platform_id,
            url=url,
            status="pending",
        )
        db.add(video)
        await db.flush()
        video_ids.append(str(video.id))

    # Create analysis record
    analysis = Analysis(
        video_id=UUID(video_ids[0]),
        user_id=user.id,
        expertise_level=req.expertise,
        style=req.style,
        ai_provider=settings.DEFAULT_AI_PROVIDER,
        ai_model=settings.DEFAULT_AI_MODEL,
        is_multi_video=len(video_ids) > 1,
        related_video_ids=video_ids[1:] if len(video_ids) > 1 else None,
        status="queued",
    )
    db.add(analysis)
    await db.flush()

    # Enqueue background job
    from app.workers.tasks import enqueue_video_analysis

    await enqueue_video_analysis(
        analysis_id=str(analysis.id),
        video_ids=video_ids,
        expertise=req.expertise,
        style=req.style,
        language=req.language,
    )

    return MessageResponse(message=f"Analysis queued. ID: {analysis.id}")


@router.post("/upload", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video file for analysis."""
    # Validate file type
    allowed = {"video/mp4", "video/x-matroska", "video/quicktime", "video/webm"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    # Check credits
    await check_and_deduct(db, user.id, settings.CREDIT_COST_UPLOAD, "video_upload")

    # Save file to local temp (in production, stream to S3)
    import tempfile
    import os

    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename or "upload.mp4")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Create video record
    video = Video(
        platform="upload",
        title=file.filename or "Uploaded Video",
        upload_path=file_path,
        status="pending",
    )
    db.add(video)
    await db.flush()

    # Enqueue processing
    from app.workers.tasks import enqueue_upload_processing

    await enqueue_upload_processing(
        video_id=str(video.id),
        file_path=file_path,
        user_id=str(user.id),
    )

    return VideoUploadResponse(
        id=video.id,
        title=video.title,
        status="processing",
        message="Upload received. Processing will begin shortly.",
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get video details."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.get("/", response_model=list[VideoResponse])
async def list_user_videos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    """List videos the user has analyzed (via their analyses)."""
    result = await db.execute(
        select(Video)
        .join(Analysis, Analysis.video_id == Video.id)
        .where(Analysis.user_id == user.id)
        .order_by(Video.created_at.desc())
        .limit(limit)
        .offset(offset)
        .distinct()
    )
    return result.scalars().all()


def _detect_platform(url: str) -> tuple[str, str | None]:
    """Detect video platform and extract platform-specific ID."""
    import re

    youtube_patterns = [
        r"(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})",
        r"(?:youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})",
    ]

    for pattern in youtube_patterns:
        match = re.search(pattern, url)
        if match:
            return "youtube", match.group(1)

    # Playlist detection
    playlist_match = re.search(r"(?:youtube\.com/playlist\?list=)([a-zA-Z0-9_-]+)", url)
    if playlist_match:
        return "youtube_playlist", playlist_match.group(1)

    return "other", None
