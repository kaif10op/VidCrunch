"""Export API routes — export analysis as PDF, Markdown, JSON."""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Analysis, Transcript, User, Video
from app.schemas.schemas import ExportRequest

router = APIRouter()


@router.post("/")
async def export_analysis(
    req: ExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export an analysis in the requested format."""
    # Get analysis
    result = await db.execute(
        select(Analysis).where(Analysis.id == req.analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Get video
    video_result = await db.execute(select(Video).where(Video.id == analysis.video_id))
    video = video_result.scalar_one_or_none()

    if req.format == "json":
        return _export_json(analysis, video)
    elif req.format == "markdown":
        return _export_markdown(analysis, video)
    elif req.format == "pdf":
        return _export_markdown(analysis, video)  # Placeholder — TODO: actual PDF gen
    elif req.format == "notion":
        return _export_json(analysis, video)  # Placeholder — TODO: Notion API
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")


def _export_json(analysis: Analysis, video: Video) -> Response:
    """Export as structured JSON."""
    data = {
        "title": video.title if video else "Untitled",
        "channel": video.channel if video else None,
        "url": video.url if video else None,
        "analysis": {
            "overview": analysis.overview,
            "key_points": analysis.key_points,
            "takeaways": analysis.takeaways,
            "timestamps": analysis.timestamps,
            "roadmap": analysis.roadmap,
            "quiz": analysis.quiz,
            "mind_map": analysis.mind_map,
            "flashcards": analysis.flashcards,
            "tags": analysis.tags,
        },
        "metadata": {
            "expertise": analysis.expertise_level,
            "style": analysis.style,
            "provider": analysis.ai_provider,
            "model": analysis.ai_model,
        },
    }

    return Response(
        content=json.dumps(data, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=analysis_{analysis.id}.json"},
    )


def _export_markdown(analysis: Analysis, video: Video) -> Response:
    """Export as Markdown document."""
    title = video.title if video else "Untitled"
    lines = [f"# {title}\n"]

    if video and video.channel:
        lines.append(f"**Channel:** {video.channel}\n")
    if video and video.url:
        lines.append(f"**URL:** {video.url}\n")

    lines.append(f"\n---\n")

    if analysis.overview:
        lines.append(f"## Overview\n\n{analysis.overview}\n")

    if analysis.key_points:
        lines.append("## Key Points\n")
        for i, point in enumerate(analysis.key_points, 1):
            lines.append(f"{i}. {point}")
        lines.append("")

    if analysis.takeaways:
        lines.append("## Takeaways\n")
        for t in analysis.takeaways:
            lines.append(f"- {t}")
        lines.append("")

    if analysis.timestamps:
        lines.append("## Chapters\n")
        for ts in analysis.timestamps:
            t = ts.get("time", "0:00") if isinstance(ts, dict) else str(ts)
            label = ts.get("label", "") if isinstance(ts, dict) else ""
            lines.append(f"- **{t}** — {label}")
        lines.append("")

    if analysis.roadmap:
        lines.append("## Learning Roadmap\n")
        steps = analysis.roadmap.get("steps", []) if isinstance(analysis.roadmap, dict) else []
        for step in steps:
            lines.append(f"### Step {step.get('step', '?')}: {step.get('task', '')}")
            lines.append(f"{step.get('description', '')}\n")

    if analysis.flashcards:
        lines.append("## Flashcards\n")
        for card in analysis.flashcards:
            front = card.get("front", "") if isinstance(card, dict) else str(card)
            back = card.get("back", "") if isinstance(card, dict) else ""
            lines.append(f"**Q:** {front}")
            lines.append(f"**A:** {back}\n")

    if analysis.tags:
        lines.append(f"\n---\n**Tags:** {', '.join(analysis.tags)}")

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=analysis_{analysis.id}.md"},
    )
