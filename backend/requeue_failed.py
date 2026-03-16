import asyncio
from uuid import UUID
import os
import sys

# Add /app to sys.path
sys.path.append("/app")

from app.workers.tasks import enqueue_video_analysis
from app.database import async_session_factory
from sqlalchemy import select
from app.models.models import Analysis

async def run():
    analysis_id = "cfa13ca2-0c58-4462-a666-efb0bf7d4f39"
    video_ids = ["f7bda998-83f6-4b1a-968f-56d29cc7bed2"]
    
    # Update status to queued first
    async with async_session_factory() as db:
        result = await db.execute(select(Analysis).where(Analysis.id == UUID(analysis_id)))
        analysis = result.scalar_one_or_none()
        if analysis:
            analysis.status = "queued"
            analysis.progress_percentage = 20 # Skip meta extraction if already done, but enqueue will re-run
            await db.commit()
            print(f"Updated analysis {analysis_id} to queued")

    await enqueue_video_analysis(
        analysis_id=analysis_id,
        video_ids=video_ids,
        expertise="intermediate",
        style="detailed",
        language="English",
        full_analysis=True
    )
    print("Enqueued video analysis")

if __name__ == "__main__":
    asyncio.run(run())
