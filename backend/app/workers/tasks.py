"""
Background worker tasks using ARQ (async Redis queue).

Tasks:
  - process_video_analysis: Full pipeline for YouTube URL analysis
  - process_upload: File upload → audio extraction → Whisper → analysis
"""

import logging
from uuid import UUID

from sqlalchemy import select

from app.config import get_settings
from app.database import async_session_factory
from app.models.models import Analysis, Transcript, TranscriptChunk, Video
from app.services.ai_pipeline import (
    chunk_transcript,
    generate_embeddings,
    synthesize_content,
)
from app.services.transcript import TranscriptEngine, extract_metadata

logger = logging.getLogger(__name__)
settings = get_settings()

transcript_engine = TranscriptEngine()


# ──────────────────────────────────────────────
# ENQUEUE HELPERS (called from API routes)
# ──────────────────────────────────────────────

async def enqueue_video_analysis(
    analysis_id: str,
    video_ids: list[str],
    expertise: str = "intermediate",
    style: str = "detailed",
    language: str = "English",
):
    """Enqueue a video analysis job. In production, this pushes to Redis via ARQ."""
    # For now, run inline (can be swapped with arq.create_pool + pool.enqueue_job)
    import asyncio

    asyncio.create_task(
        process_video_analysis(
            {}, analysis_id, video_ids, expertise, style, language
        )
    )


async def enqueue_upload_processing(
    video_id: str,
    file_path: str,
    user_id: str,
):
    """Enqueue an upload processing job."""
    import asyncio

    asyncio.create_task(
        process_upload({}, video_id, file_path, user_id)
    )


# ──────────────────────────────────────────────
# WORKER TASKS
# ──────────────────────────────────────────────

async def process_video_analysis(
    ctx: dict,
    analysis_id: str,
    video_ids: list[str],
    expertise: str,
    style: str,
    language: str,
):
    """
    Full video analysis pipeline with parallelism and progress reporting.
    """
    async with async_session_factory() as db:
        try:
            # Update status
            analysis = await _get_analysis(db, analysis_id)
            if not analysis:
                logger.error(f"Analysis {analysis_id} not found")
                return

            analysis.status = "processing"
            analysis.progress_percentage = 5
            await db.commit()

            import asyncio

            # Internal helper for parallel video processing
            async def process_single_video(vid_id_str: str):
                async with async_session_factory() as vid_db:
                    vid_uuid = UUID(vid_id_str)
                    video = await _get_video(vid_db, vid_uuid)
                    if not video:
                        return None, None

                    video.status = "processing"
                    video.progress_percentage = 10
                    await vid_db.commit()

                    platform_id = video.platform_id
                    if not platform_id and video.url:
                        import re
                        match = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", video.url or "")
                        if match:
                            platform_id = match.group(1)

                    if not platform_id:
                        video.status = "failed"
                        video.error_message = "Could not extract video ID"
                        await vid_db.commit()
                        return None, None

                    # Step 1: Metadata
                    try:
                        metadata = await extract_metadata(platform_id)
                        video.title = metadata.get("title", video.title)
                        video.channel = metadata.get("channel")
                        video.description = metadata.get("description")
                        video.duration_seconds = metadata.get("duration_seconds")
                        video.thumbnail_url = metadata.get("thumbnail_url")
                        video.language = metadata.get("language")
                        video.progress_percentage = 20
                        await vid_db.commit()
                    except Exception as e:
                        logger.warning(f"Metadata extraction failed: {e}")
                        metadata = {}

                    # Step 2: Extract transcript
                    try:
                        transcript_result = await transcript_engine.extract(platform_id)
                        video.progress_percentage = 50
                        await vid_db.commit()
                    except Exception as e:
                        logger.error(f"Transcript extraction failed for {platform_id}: {e}")
                        video.status = "failed"
                        video.error_message = str(e)
                        await vid_db.commit()
                        return None, None

                    # Store transcript
                    transcript_record = Transcript(
                        video_id=vid_uuid,
                        full_text=transcript_result.full_text,
                        language=transcript_result.language,
                        source=transcript_result.source,
                        word_count=transcript_result.word_count,
                        timestamps_json=[
                            {"start": s.start, "end": s.end, "text": s.text}
                            for s in transcript_result.segments
                        ],
                    )
                    vid_db.add(transcript_record)

                    # Step 3: Chunk and Embed
                    chunks = chunk_transcript(transcript_result.full_text)
                    chunk_texts = [c["text"] for c in chunks]
                    embeddings = await generate_embeddings(chunk_texts)

                    for chunk_data, embedding in zip(chunks, embeddings):
                        chunk_record = TranscriptChunk(
                            video_id=vid_uuid,
                            chunk_index=chunk_data["chunk_index"],
                            text=chunk_data["text"],
                            start_time=chunk_data.get("start_time"),
                            end_time=chunk_data.get("end_time"),
                            token_count=chunk_data.get("token_count"),
                            embedding=embedding if any(e != 0.0 for e in embedding) else None,
                        )
                        vid_db.add(chunk_record)

                    video.status = "ready"
                    video.progress_percentage = 100
                    await vid_db.commit()

                    return f'[Video: "{video.title}"]\n{transcript_result.full_text}', metadata

            # Process all videos in parallel
            tasks = [process_single_video(vid_id) for vid_id in video_ids]
            results = await asyncio.gather(*tasks)

            all_transcripts = [r[0] for r in results if r[0]]
            all_metadata = [r[1] for r in results if r[1]]
            primary_metadata = all_metadata[0] if all_metadata else {}

            if not all_transcripts:
                analysis.status = "failed"
                analysis.error_message = "No transcripts could be extracted"
                analysis.progress_percentage = 0
                await db.commit()
                return

            # Step 6: AI Synthesis
            analysis.progress_percentage = 70
            await db.commit()

            combined_transcript = "\n\n---\n\n".join(all_transcripts)
            is_multi = len(video_ids) > 1

            ai_result = await synthesize_content(
                transcript_text=combined_transcript,
                metadata=primary_metadata,
                expertise=expertise,
                style=style,
                language=language,
                is_multi_video=is_multi,
            )

            # Store analysis results
            analysis.overview = ai_result.get("overview")
            analysis.key_points = ai_result.get("keyPoints")
            analysis.takeaways = ai_result.get("takeaways")
            analysis.timestamps = ai_result.get("timestamps")
            analysis.roadmap = ai_result.get("roadmap")
            analysis.quiz = ai_result.get("quiz")
            analysis.mind_map = ai_result.get("mindMap")
            analysis.flashcards = ai_result.get("flashcards")
            analysis.learning_context = ai_result.get("learningContext")
            analysis.tags = ai_result.get("tags")
            analysis.status = "completed"
            analysis.progress_percentage = 100

            await db.commit()
            logger.info(f"Analysis {analysis_id} completed successfully")

        except Exception as e:
            logger.error(f"Analysis {analysis_id} failed: {e}", exc_info=True)
            try:
                # Refresh analysis from db as its state might be stale
                analysis = await _get_analysis(db, analysis_id)
                if analysis:
                    analysis.status = "failed"
                    analysis.error_message = str(e)[:1000]
                    analysis.progress_percentage = 0
                    await db.commit()
            except Exception:
                pass

        except Exception as e:
            logger.error(f"Analysis {analysis_id} failed: {e}", exc_info=True)
            try:
                analysis = await _get_analysis(db, analysis_id)
                if analysis:
                    analysis.status = "failed"
                    analysis.error_message = str(e)[:1000]
                    await db.commit()
            except Exception:
                pass


async def process_upload(
    ctx: dict,
    video_id: str,
    file_path: str,
    user_id: str,
):
    """Process an uploaded video file: extract audio → Whisper → analysis."""
    async with async_session_factory() as db:
        try:
            vid_uuid = UUID(video_id)
            video = await _get_video(db, vid_uuid)
            if not video:
                return

            video.status = "processing"
            await db.commit()

            # Transcribe with Whisper
            engine = TranscriptEngine()
            transcript_result = await engine._transcribe_with_whisper(file_path)

            if not transcript_result:
                video.status = "failed"
                video.error_message = "Whisper transcription failed"
                await db.commit()
                return

            # Store transcript
            transcript_record = Transcript(
                video_id=vid_uuid,
                full_text=transcript_result.full_text,
                language=transcript_result.language,
                source="whisper",
                word_count=transcript_result.word_count,
            )
            db.add(transcript_record)

            video.status = "ready"
            await db.commit()

            # Create analysis
            analysis = Analysis(
                video_id=vid_uuid,
                user_id=UUID(user_id),
                expertise_level="intermediate",
                style="detailed",
                ai_provider=settings.DEFAULT_AI_PROVIDER,
                ai_model=settings.DEFAULT_AI_MODEL,
                status="processing",
            )
            db.add(analysis)
            await db.flush()

            ai_result = await synthesize_content(
                transcript_text=transcript_result.full_text,
                metadata={"title": video.title, "channel": "Uploaded Video"},
            )

            analysis.overview = ai_result.get("overview")
            analysis.key_points = ai_result.get("keyPoints")
            analysis.takeaways = ai_result.get("takeaways")
            analysis.timestamps = ai_result.get("timestamps")
            analysis.roadmap = ai_result.get("roadmap")
            analysis.quiz = ai_result.get("quiz")
            analysis.mind_map = ai_result.get("mindMap")
            analysis.flashcards = ai_result.get("flashcards")
            analysis.learning_context = ai_result.get("learningContext")
            analysis.tags = ai_result.get("tags")
            analysis.status = "completed"

            await db.commit()
            logger.info(f"Upload processing for video {video_id} completed")

        except Exception as e:
            logger.error(f"Upload processing failed: {e}", exc_info=True)
            try:
                video = await _get_video(db, UUID(video_id))
                if video:
                    video.status = "failed"
                    video.error_message = str(e)[:1000]
                    await db.commit()
            except Exception:
                pass


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

async def _get_analysis(db, analysis_id: str) -> Analysis | None:
    result = await db.execute(select(Analysis).where(Analysis.id == UUID(analysis_id)))
    return result.scalar_one_or_none()


async def _get_video(db, video_id: UUID) -> Video | None:
    result = await db.execute(select(Video).where(Video.id == video_id))
    return result.scalar_one_or_none()


# ──────────────────────────────────────────────
# ARQ WORKER CONFIG (for production deployment)
# ──────────────────────────────────────────────

class WorkerSettings:
    """ARQ worker settings — run with: arq app.workers.tasks.WorkerSettings"""
    functions = [process_video_analysis, process_upload]
    
    # Use the Redis URL from settings
    from arq.connections import RedisSettings
    import urllib.parse
    
    parsed = urllib.parse.urlparse(settings.REDIS_URL)
    redis_settings = RedisSettings(host=parsed.hostname or 'localhost', port=parsed.port or 6379)

    @staticmethod
    async def on_startup(ctx):
        logger.info("ARQ worker started")

    @staticmethod
    async def on_shutdown(ctx):
        logger.info("ARQ worker stopped")
