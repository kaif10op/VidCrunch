import asyncio
import logging
logging.disable(logging.CRITICAL)

from sqlalchemy import select, desc
from app.database import async_session_factory
from app.models.models import Analysis

async def main():
    async with async_session_factory() as db:
        result = await db.execute(
            select(Analysis).order_by(desc(Analysis.created_at)).limit(3)
        )
        analyses = result.scalars().all()
        
        lines = []
        for a in analyses:
            lines.append(f"--- Analysis {a.id} ---")
            lines.append(f"Status: {a.status}")
            lines.append(f"Error: {a.error_message}")
            lines.append(f"Progress: {a.progress_percentage}")
            lines.append(f"Has overview: {bool(a.overview)}")
            lines.append(f"Has timestamps: {bool(a.timestamps)}, count={len(a.timestamps) if a.timestamps else 0}")
            lines.append(f"Has key_points: {bool(a.key_points)}, count={len(a.key_points) if a.key_points else 0}")
            lines.append(f"Has tags: {bool(a.tags)}")
            lines.append(f"Status msg: {a.status_message}")
            lines.append(f"Video ID: {a.video_id}")
            lines.append("")
        
        with open("analysis_report.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        print("Written to analysis_report.txt")

asyncio.run(main())
