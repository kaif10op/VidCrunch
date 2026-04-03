"""Video API routes — analyze URLs, upload files, get video details."""

import os
import tempfile
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
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
from app.middleware.rate_limit import limiter

router = APIRouter()
settings = get_settings()


@router.post("/analyze", response_model=MessageResponse)
@limiter.limit("10/minute")  # Rate limit video analysis
async def analyze_videos(
    request: Request,
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
                select(Video)
                .where(Video.platform == platform, Video.platform_id == platform_id)
                .order_by(Video.created_at.desc())
                .limit(1)
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
        full_analysis=req.full_analysis,
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
        full_analysis=req.full_analysis,
    )

    return MessageResponse(message=f"Analysis queued. ID: {analysis.id}")


@router.post("/upload", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video or audio file for analysis."""
    # Validate file type - support both video and audio
    allowed_video = {"video/mp4", "video/x-matroska", "video/quicktime", "video/webm"}
    allowed_audio = {"audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/x-m4a", "audio/mp4"}
    allowed = allowed_video | allowed_audio
    
    # Also check file extension for browsers that don't send correct MIME types
    allowed_extensions = {".mp4", ".mkv", ".mov", ".webm", ".mp3", ".wav", ".m4a"}
    file_ext = os.path.splitext(file.filename or "")[1].lower() if file.filename else ""
    
    if file.content_type not in allowed and file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file.content_type}. Supported: MP4, MKV, MOV, WebM, MP3, WAV, M4A"
        )

    # Check credits
    await check_and_deduct(db, user.id, settings.CREDIT_COST_UPLOAD, "video_upload")

    # Save file to local temp (in production, stream to S3)
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename or "upload.mp4")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Create video record
    video = Video(
        platform="upload",
        title=file.filename or "Uploaded File",
        upload_path=file_path,
        status="pending",
    )
    db.add(video)
    await db.flush()

    # Enqueue processing
    from app.workers.tasks import enqueue_upload_processing

    # Create an initial analysis record for polling
    analysis = Analysis(
        video_id=video.id,
        user_id=user.id,
        expertise_level=user.settings.expertise if user.settings else "intermediate",
        style="detailed",
        ai_provider=settings.DEFAULT_AI_PROVIDER,
        ai_model=settings.DEFAULT_AI_MODEL,
        status="queued",
        progress_percentage=0,
    )
    db.add(analysis)
    await db.commit()

    await enqueue_upload_processing(
        video_id=str(video.id),
        analysis_id=str(analysis.id),
        file_path=file_path,
        user_id=str(user.id),
    )

    return VideoUploadResponse(
        id=video.id,
        analysis_id=analysis.id,
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
    from sqlalchemy.orm import joinedload
    from app.models.models import Analysis
    
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
