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

async def _get_redis_pool():
    """Create an ARQ Redis connection pool."""
    from arq import create_pool
    from arq.connections import RedisSettings
    import urllib.parse

    parsed = urllib.parse.urlparse(settings.REDIS_URL)
    redis_settings = RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
    )
    return await create_pool(redis_settings)


async def enqueue_video_analysis(
    analysis_id: str,
    video_ids: list[str],
    expertise: str = "intermediate",
    style: str = "detailed",
    language: str = "English",
    full_analysis: bool = False,
):
    """Enqueue a video analysis job via ARQ Redis queue."""
    pool = await _get_redis_pool()
    await pool.enqueue_job(
        "process_video_analysis",
        analysis_id, video_ids, expertise, style, language, full_analysis,
    )
    await pool.close()


async def enqueue_upload_processing(
    video_id: str,
    file_path: str,
    user_id: str,
):
    """Enqueue an upload processing job via ARQ Redis queue."""
    pool = await _get_redis_pool()
    await pool.enqueue_job(
        "process_upload",
        video_id, file_path, user_id,
    )
    await pool.close()



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
    full_analysis: bool = False,
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
            analysis.estimated_remaining_seconds = 120  # initial guess
            await db.commit()

            import asyncio
            import time
            start_time = time.time()

            def update_estimation(progress: int):
                elapsed = time.time() - start_time
                if progress > 5:
                    total_est = elapsed / (progress / 100.0)
                    remaining = max(0, int(total_est - elapsed))
                    return remaining
                return 120

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

                    logger.info(f"DEBUG [{vid_uuid}]: Starting metadata extraction for {platform_id}")
                    # Step 1: Metadata
                    try:
                        metadata = await extract_metadata(platform_id)
                        video.title = metadata.get("title", video.title)
                        video.channel = metadata.get("channel")
                        video.description = metadata.get("description")
                        video.duration_seconds = metadata.get("duration_seconds")
                        video.view_count = metadata.get("view_count")
                        video.like_count = metadata.get("like_count")
                        video.published_at = metadata.get("published_at")
                        video.thumbnail_url = metadata.get("thumbnail_url")
                        video.language = metadata.get("language")
                        video.progress_percentage = 20
                        await vid_db.commit()
                        logger.info(f"DEBUG [{vid_uuid}]: Metadata updated: {video.title}")
                    except Exception as e:
                        logger.warning(f"DEBUG [{vid_uuid}]: Metadata extraction failed: {e}")
                        metadata = {}

                    # Check if transcript already exists to skip duplicate extraction
                    existing_transcript = await vid_db.execute(
                        select(Transcript).where(Transcript.video_id == vid_uuid)
                    )
                    existing = existing_transcript.scalar_one_or_none()
                    logger.info(f"DEBUG [{vid_uuid}]: Checking existing transcript...", )

                    if existing:
                        logger.info(f"DEBUG [{vid_uuid}]: Existing record found. Word count: {existing.word_count}", )
                    
                    if existing and existing.full_text and getattr(existing, 'word_count', 0) and existing.word_count > 50:
                        logger.info(f"DEBUG [{vid_uuid}]: Using cache path...", )
                        class CachedSegment:
                            def __init__(self, start, end, text):
                                self.start = start
                                self.end = end
                                self.text = text

                        class CachedResult:
                            def __init__(self, full_text, segments, language, source, word_count):
                                self.full_text = full_text
                                self.segments = segments
                                self.language = language
                                self.source = source
                                self.word_count = word_count

                        transcript_result = CachedResult(
                            full_text=existing.full_text,
                            segments=[CachedSegment(t.get("start", 0), t.get("end", 0), t.get("text", "")) for t in existing.timestamps_json],
                            language=existing.language or "en",
                            source=existing.source or "cache",
                            word_count=existing.word_count,
                        )
                        video.progress_percentage = 100
                        video.status = "ready"
                        await vid_db.commit()
                        logger.info(f"DEBUG [{vid_uuid}]: Cache path complete.", )
                    else:
                        logger.info(f"DEBUG [{vid_uuid}]: Entering extraction path...", )
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

                        # Store transcript (upsert)
                        # Do a fresh check for existing transcript to avoid race conditions or stale state
                        fresh_transcript_result = await vid_db.execute(
                            select(Transcript).where(Transcript.video_id == vid_uuid)
                        )
                        fresh_existing = fresh_transcript_result.scalar_one_or_none()
                        
                        if fresh_existing:
                            fresh_existing.full_text = transcript_result.full_text
                            fresh_existing.language = transcript_result.language
                            fresh_existing.source = transcript_result.source
                            fresh_existing.word_count = transcript_result.word_count
                            fresh_existing.timestamps_json = [
                                {"start": s.start, "end": s.end, "text": s.text}
                                for s in transcript_result.segments
                            ]
                        else:
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
                        
                        await vid_db.flush() # Ensure it's pushed to DB before we delete chunks

                        # Clear any existing chunks to prevent duplicates
                        from sqlalchemy import delete
                        await vid_db.execute(delete(TranscriptChunk).where(TranscriptChunk.video_id == vid_uuid))

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

            # Process all videos in parallel and update progress as each one completes
            results = []
            completed_count = 0
            total_videos = len(video_ids)
            
            logger.info(f"Starting parallel processing for {total_videos} videos")
            
            for task in asyncio.as_completed([process_single_video(vid_id) for vid_id in video_ids]):
                result = await task
                results.append(result)
                completed_count += 1
                
                # Update analysis progress: 5% base + up to 55% for videos (total 60%)
                progress = int(5 + (completed_count / total_videos) * 55)
                
                # Re-fetch analysis to ensure session is fresh
                analysis = await _get_analysis(db, analysis_id)
                if analysis:
                    analysis.progress_percentage = progress
                    analysis.estimated_remaining_seconds = update_estimation(progress)
                    await db.commit()
                    logger.info(f"Analysis {analysis_id} progress: {progress}% ({completed_count}/{total_videos} videos done)")

            # Final check for results
            all_transcripts = [r[0] for r in results if r and r[0]]
            all_metadata = [r[1] for r in results if r and r[1]]
            primary_metadata = all_metadata[0] if all_metadata else {}

            if not all_transcripts:
                analysis.status = "failed"
                analysis.error_message = "No transcripts could be extracted"
                analysis.progress_percentage = 0
                analysis.estimated_remaining_seconds = 0
                await db.commit()
                return

            # Step 6: AI Synthesis
            analysis.progress_percentage = 80
            analysis.estimated_remaining_seconds = update_estimation(80)
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
                minimal_mode=not full_analysis,
            )

            # Store core analysis results
            analysis.overview = ai_result.get("overview")
            analysis.key_points = ai_result.get("key_points")
            analysis.takeaways = ai_result.get("takeaways")
            analysis.timestamps = ai_result.get("timestamps")
            analysis.learning_context = ai_result.get("learning_context")
            analysis.tags = ai_result.get("tags")
            
            # Specialized tools (quiz, roadmap, mind_map, flashcards, podcast) 
            # are generated on-demand via the generate_tool endpoint.
            
            analysis.status = "completed"
            analysis.progress_percentage = 100
            analysis.estimated_remaining_seconds = 0

            await db.commit()
            logger.info(f"Analysis {analysis_id} completed successfully (full={full_analysis})")

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
                timestamps_json=[
                    {"start": s.start, "end": s.end, "text": s.text}
                    for s in transcript_result.segments
                ],
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

            # Store core analysis results
            analysis.overview = ai_result.get("overview")
            analysis.key_points = ai_result.get("key_points")
            analysis.takeaways = ai_result.get("takeaways")
            analysis.timestamps = ai_result.get("timestamps")
            analysis.learning_context = ai_result.get("learning_context")
            analysis.tags = ai_result.get("tags")
            
            # Note: specialized tools (roadmap, quiz, mind_map, flashcards, podcast) 
            # are NOT populated here. They are generated on-demand via the generate_tool endpoint.
            
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
