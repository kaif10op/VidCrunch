"""Spaces API routes — create, list, add/remove videos."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Space, SpaceVideo, User, Video
from app.schemas.schemas import (
    MessageResponse,
    SpaceAddVideoRequest,
    SpaceCreateRequest,
    SpaceUpdateRequest,
    SpaceResponse,
    VideoResponse,
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
        created_at=space.created_at,
    )


@router.get("/", response_model=list[SpaceResponse])
async def list_spaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Space,
            func.count(SpaceVideo.id).label("video_count"),
        )
        .outerjoin(SpaceVideo, SpaceVideo.space_id == Space.id)
        .where(Space.user_id == user.id)
        .group_by(Space.id)
        .order_by(Space.created_at.desc())
    )

    return [
        SpaceResponse(
            id=space.id,
            name=space.name,
            description=space.description,
            is_public=space.is_public,
            video_count=video_count,
            video_ids=[sv.video_id for sv in space.space_videos],
            created_at=space.created_at,
        )
        for space, video_count in result.all()
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
    return result.scalars().all()


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

    # Check duplicate
    existing = await db.execute(
        select(SpaceVideo).where(
            SpaceVideo.space_id == id_uuid, SpaceVideo.video_id == req.video_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Video already in space")

    db.add(SpaceVideo(space_id=id_uuid, video_id=req.video_id))
    return MessageResponse(message="Video added to space")


@router.delete("/{space_id}/videos/{video_id}", response_model=MessageResponse)
async def remove_video_from_space(
    space_id: str,
    video_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        id_uuid = UUID(space_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Space not found")

    result = await db.execute(
        select(SpaceVideo).where(
            SpaceVideo.space_id == id_uuid, SpaceVideo.video_id == video_id
        )
    )
    sv = result.scalar_one_or_none()
    if not sv:
        raise HTTPException(status_code=404, detail="Video not in space")

    await db.delete(sv)
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

    # Re-fetch with video count
    res = await db.execute(
        select(func.count(SpaceVideo.id)).where(SpaceVideo.space_id == space.id)
    )
    video_count = res.scalar() or 0

    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_public=space.is_public,
        video_count=video_count,
        video_ids=[sv.video_id for sv in space.space_videos],
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

    await db.delete(space)
    return MessageResponse(message="Space deleted")
