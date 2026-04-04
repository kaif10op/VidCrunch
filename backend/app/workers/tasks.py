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
from app.models.models import Analysis, Transcript, TranscriptChunk, Video, Document, DocumentChunk
from app.services.ai_pipeline import (
    chunk_transcript,
    generate_embeddings,
    synthesize_content,
)
from app.services.transcript import TranscriptEngine, extract_metadata, TranscriptResult, TranscriptSegment

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

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
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
    analysis_id: str,
    file_path: str,
    user_id: str,
):
    """Enqueue an upload processing job via ARQ Redis queue."""
    pool = await _get_redis_pool()
    await pool.enqueue_job(
        "process_upload",
        video_id, analysis_id, file_path, user_id,
    )
    await pool.close()


async def enqueue_document_processing(
    document_id: str,
    file_path: str,
    file_type: str,
):
    """Enqueue a document processing job via ARQ Redis queue."""
    pool = await _get_redis_pool()
    await pool.enqueue_job(
        "process_document",
        document_id, file_path, file_type,
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
    Full video analysis pipeline with parallelism and granular progress reporting.
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
                    # Smoothing factor for time estimation
                    total_est = elapsed / (progress / 100.0)
                    remaining = max(0, int(total_est - elapsed))
                    return remaining
                return 120

            # Internal helper for parallel video processing
            async def process_single_video(vid_wid_str: str, vid_idx: int, total_vids: int):
                async with async_session_factory() as vid_db:
                    vid_uuid = UUID(vid_wid_str)
                    video = await _get_video(vid_db, vid_uuid)
                    if not video:
                        return None, None

                    video.status = "processing"
                    video.progress_percentage = 5
                    await vid_db.commit()

                    # Batched progress: fewer DB round-trips
                    _last_progress = [0]
                    async def set_parent_prog(p: int, msg: str = None):
                        """Update both specific video and parent analysis progress."""
                        # Skip minor increments (< 10%) to reduce DB churn
                        if p - _last_progress[0] < 8 and p < 95 and not msg:
                            return
                        _last_progress[0] = p
                        video.progress_percentage = p
                        await vid_db.commit()
                        
                        vid_share = 55.0 / total_vids
                        global_p = int(5 + (vid_idx * vid_share) + (p / 100.0 * vid_share))
                        
                        async with async_session_factory() as p_db:
                            analysis = await _get_analysis(p_db, analysis_id)
                            if analysis:
                                analysis.progress_percentage = max(analysis.progress_percentage, global_p)
                                if msg:
                                    analysis.status_message = msg
                                analysis.estimated_remaining_seconds = update_estimation(analysis.progress_percentage)
                                await p_db.commit()

                    platform_id = video.platform_id
                    if not platform_id and video.url:
                        import re
                        match = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", video.url or "")
                        if match:
                            platform_id = match.group(1)

                    # Check for existing transcript FIRST (instant cache hit = skip everything)
                    existing_transcript = await vid_db.execute(
                        select(Transcript).where(Transcript.video_id == vid_uuid)
                    )
                    existing = existing_transcript.scalar_one_or_none()
                    
                    if existing and existing.full_text and getattr(existing, 'word_count', 0) > 50:
                        logger.info(f"[{vid_uuid}] Using cached transcript — skipping extraction")
                        
                        class CachedResult:
                            def __init__(self, full_text, segments, language, source, word_count):
                                self.full_text = full_text
                                self.segments = segments
                                self.language = language
                                self.source = source
                                self.word_count = word_count

                        class CachedSegment:
                            def __init__(self, start, end, text):
                                self.start = start
                                self.end = end
                                self.text = text

                        transcript_result = CachedResult(
                            full_text=existing.full_text,
                            segments=[CachedSegment(t.get("start", 0), t.get("end", 0), t.get("text", "")) for t in existing.timestamps_json or []],
                            language=existing.language or "en",
                            source=existing.source or "cache",
                            word_count=existing.word_count,
                        )
                        # Still need metadata for AI synthesis context
                        metadata = {"title": video.title or "Unknown", "channel": video.channel or "Unknown"}
                        await set_parent_prog(80, "Using cached transcript")
                    else:
                        # ── PARALLEL: Metadata + Transcript extraction at the same time ──
                        logger.info(f"[{vid_uuid}] Starting PARALLEL metadata + transcript for {platform_id}")
                        await set_parent_prog(10, "Fetching video details...")

                        async def _extract_meta():
                            try:
                                return await extract_metadata(platform_id)
                            except Exception as e:
                                logger.warning(f"[{vid_uuid}] Metadata extraction failed: {e}")
                                return {}

                        async def _extract_transcript():
                            async def transcript_progress(stage: int, total: int, msg: str):
                                p = 20 + int((stage / total) * 55)
                                await set_parent_prog(p)
                            try:
                                return await transcript_engine.extract(
                                    platform_id,
                                    progress_callback=transcript_progress
                                )
                            except Exception as e:
                                logger.error(f"[{vid_uuid}] Transcription failed: {e}")
                                return None

                        # Run both concurrently — this is the biggest time saver
                        metadata, transcript_result = await asyncio.gather(
                            _extract_meta(), _extract_transcript()
                        )

                        # Apply metadata to video record
                        if metadata:
                            video.title = metadata.get("title", video.title)
                            video.channel = metadata.get("channel", video.channel)
                            video.duration_seconds = metadata.get("duration_seconds", video.duration_seconds)
                            video.thumbnail_url = metadata.get("thumbnail_url", video.thumbnail_url)
                            video.description = metadata.get("description", video.description)
                            if metadata.get("chapters"):
                                chapter_str = "\n\n[CHAPTERS]\n" + "\n".join([f"{c['time']} {c['label']}" for c in metadata["chapters"]])
                                if chapter_str not in (video.description or ""):
                                    video.description = (video.description or "") + chapter_str
                                async with async_session_factory() as p_db:
                                    p_analysis = await _get_analysis(p_db, analysis_id)
                                    if p_analysis:
                                        p_analysis.timestamps = metadata["chapters"]
                                        if not p_analysis.roadmap:
                                            p_analysis.roadmap = {"chapters": metadata["chapters"]}
                                        await p_db.commit()
                            await vid_db.commit()

                        # Handle transcript failure → metadata fallback
                        if not transcript_result:
                            logger.warning(f"[{vid_uuid}] Transcript failed. Pivoting to metadata fallback...")
                            await set_parent_prog(65, "Pivoting to Metadata Analysis...")
                            try:
                                meta = metadata or await extract_metadata(platform_id)
                                pseudo_text = f"ANALYSIS SOURCE: VIDEO METADATA (Transcription Unavailable)\n\n"
                                pseudo_text += f"TITLE: {meta.get('title', 'Unknown')}\n\n"
                                pseudo_text += f"DESCRIPTION:\n{meta.get('description', 'No description available.')}"
                                video.title = meta.get('title', 'Unknown')
                                video.description = meta.get('description', '')
                                video.thumbnail_url = meta.get('thumbnail_url', video.thumbnail_url)
                                video.duration_seconds = meta.get('duration_seconds', video.duration_seconds)
                                video.channel = meta.get('channel', video.channel)
                                await vid_db.commit()

                                segments = []
                                meta_chapters = meta.get('chapters', [])
                                if meta_chapters:
                                    for i, ch in enumerate(meta_chapters):
                                        parts = ch['time'].split(':')
                                        curr_time = 0
                                        if len(parts) == 3: curr_time = int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
                                        elif len(parts) == 2: curr_time = int(parts[0])*60 + int(parts[1])
                                        if i > 0 and segments:
                                            segments[-1].end = float(curr_time)
                                        segments.append(TranscriptSegment(
                                            start=float(curr_time), end=float(curr_time + 60),
                                            text=f"Chapter: {ch['label']}"
                                        ))
                                if not segments:
                                    segments = [TranscriptSegment(start=0, end=float(meta.get('duration_seconds', 60)), text="Video Context (Metadata Analysis)")]
                                transcript_result = TranscriptResult(
                                    full_text=pseudo_text, segments=segments,
                                    language=meta.get('language', 'en'), source="metadata_fallback",
                                    word_count=len(pseudo_text.split())
                                )
                            except Exception as meta_e:
                                logger.error(f"[{vid_uuid}] Metadata fallback also failed: {meta_e}")
                                video.status = "failed"
                                video.error_message = f"Transcription and Metadata fallback failed"
                                await vid_db.commit()
                                return None, None

                        await set_parent_prog(75, "Transcription complete")

                        # Store transcript record (lightweight — skip chunk storage for single fast path)
                        fresh_transcript_result = await vid_db.execute(
                            select(Transcript).where(Transcript.video_id == vid_uuid)
                        )
                        fresh_existing = fresh_transcript_result.scalar_one_or_none()
                        ts_json = [{"start": s.start, "end": s.end, "text": s.text} for s in transcript_result.segments]
                        
                        if fresh_existing:
                            fresh_existing.full_text = transcript_result.full_text
                            fresh_existing.language = transcript_result.language
                            fresh_existing.source = transcript_result.source
                            fresh_existing.word_count = transcript_result.word_count
                            fresh_existing.timestamps_json = ts_json
                        else:
                            vid_db.add(Transcript(
                                video_id=vid_uuid,
                                full_text=transcript_result.full_text,
                                language=transcript_result.language,
                                source=transcript_result.source,
                                word_count=transcript_result.word_count,
                                timestamps_json=ts_json,
                            ))
                        await vid_db.flush()
                        await set_parent_prog(80)

                    # Chunk storage — only for multi-video or full analysis
                    if len(video_ids) > 1 or full_analysis:
                        logger.info(f"[{vid_uuid}] Full analysis: chunking + embedding...")
                        chunks = chunk_transcript(transcript_result.full_text)
                        from sqlalchemy import delete
                        await vid_db.execute(delete(TranscriptChunk).where(TranscriptChunk.video_id == vid_uuid))
                        await set_parent_prog(85, "Generating search index...")
                        embeddings = await generate_embeddings([c["text"] for c in chunks])
                        for chunk_data, embedding in zip(chunks, embeddings):
                            vid_db.add(TranscriptChunk(
                                video_id=vid_uuid,
                                chunk_index=chunk_data["chunk_index"],
                                text=chunk_data["text"],
                                start_time=chunk_data.get("start_time"),
                                end_time=chunk_data.get("end_time"),
                                token_count=chunk_data.get("token_count"),
                                embedding=embedding if any(e != 0.0 for e in embedding) else None,
                            ))
                    else:
                        logger.info(f"[{vid_uuid}] Fast track: skipping chunk storage")

                    video.status = "ready"
                    await set_parent_prog(100, "Analysis ready")
                    return f'[Video: "{video.title}"]\n{transcript_result.full_text}', metadata

            # Process all videos
            results = []
            completed_count = 0
            total_videos = len(video_ids)
            
            tasks_list = [process_single_video(vid_id, i, total_videos) for i, vid_id in enumerate(video_ids)]
            for task in asyncio.as_completed(tasks_list):
                result = await task
                results.append(result)
                completed_count += 1
                
                # Final check for this video's contribution
                progress = int(5 + (completed_count / total_videos) * 55)
                analysis = await _get_analysis(db, analysis_id)
                if analysis:
                    analysis.progress_percentage = max(analysis.progress_percentage, progress)
                    analysis.estimated_remaining_seconds = update_estimation(analysis.progress_percentage)
                    await db.commit()

            all_transcripts = [r[0] for r in results if r and r[0]]
            all_metadata = [r[1] for r in results if r and r[1]]
            primary_metadata = all_metadata[0] if all_metadata else {}

            if not all_transcripts:
                analysis.status = "failed"
                analysis.error_message = "Transcription failed for all videos"
                await db.commit()
                return

            # AI Synthesis - Fast initial analysis
            combined_transcript = "\n\n---\n\n".join(all_transcripts)
            word_count = len(combined_transcript.split())
            
            # Ultra-Scale logic for 10+ hours (approx > 50k words)
            is_ultra_scale = word_count > 50000
            
            logger.info(f"Analysis {analysis_id}: Starting AI synthesis ({word_count} words, UltraScale={is_ultra_scale})...")
            analysis.progress_percentage = 70
            # Rough estimate: 12s base + 6s per 5000 words (optimized for Groq speed)
            est_seconds = 12 + int(word_count / 800)
            analysis.estimated_remaining_seconds = est_seconds
            await db.commit()
            
            synthesis_start = time.time()
            try:
                # Use a tighter timeout for synthesis of standard videos
                async with asyncio.timeout(90.0 if not is_ultra_scale else 300.0):
                    ai_result = await synthesize_content(
                        transcript_text=combined_transcript,
                        metadata=primary_metadata,
                        expertise=expertise,
                        style=style,
                        language=language,
                        is_multi_video=len(video_ids) > 1,
                        minimal_mode=not full_analysis,
                        max_tokens=4000 if not full_analysis else 8000
                    )
                synthesis_time = time.time() - synthesis_start
                logger.info(f"Analysis {analysis_id}: Synthesis finished in {synthesis_time:.2f}s")
            except Exception as ai_err:
                logger.error(f"AI synthesis failed: {ai_err}")
                # Even if AI fails, we still have the transcript - mark as partial success
                analysis.status = "completed"
                analysis.error_message = f"AI analysis partial: {str(ai_err)[:200]}"
                analysis.progress_percentage = 100
                await db.commit()
                return

            analysis.progress_percentage = 95
            await db.commit()

            # Store result
            analysis.overview = ai_result.get("overview")
            analysis.key_points = ai_result.get("key_points")
            analysis.takeaways = ai_result.get("takeaways")
            analysis.timestamps = ai_result.get("timestamps")
            analysis.learning_context = ai_result.get("learning_context")
            analysis.tags = ai_result.get("tags")
            analysis.status = "completed"
            analysis.progress_percentage = 100
            analysis.estimated_remaining_seconds = 0
            await db.commit()
            
            logger.info(f"Analysis {analysis_id} completed successfully")

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
    analysis_id: str,
    file_path: str,
    user_id: str,
):
    """Process an uploaded file: transcribe → analyze with granular progress."""
    async with async_session_factory() as db:
        try:
            vid_uuid = UUID(video_id)
            ana_uuid = UUID(analysis_id)
            
            video = await _get_video(db, vid_uuid)
            analysis = await db.scalar(select(Analysis).where(Analysis.id == ana_uuid))
            
            if not video or not analysis:
                logger.error(f"Upload processing aborted: Video {vid_uuid} or Analysis {ana_uuid} not found")
                return

            analysis.status = "processing"
            analysis.progress_percentage = 5
            await db.commit()
            
            import time
            start_time = time.time()

            async def update_prog(p: int):
                video.progress_percentage = p
                await db.commit()
                # 60% for transcription, 40% for analysis
                global_p = int(5 + (p / 100.0 * 55))
                analysis.progress_percentage = global_p
                elapsed = time.time() - start_time
                if global_p > 5:
                    total_est = elapsed / (global_p / 100.0)
                    analysis.estimated_remaining_seconds = max(0, int(total_est - elapsed))
                await db.commit()

            video.status = "processing"
            await update_prog(10)

            # Transcription - uses cloud APIs first, then local Whisper
            engine = TranscriptEngine()
            
            async def transcribe_progress(stage: int, total: int, msg: str):
                # Scale stages 1-3 to progress 10-90
                p = int(10 + (stage / total) * 80)
                await update_prog(p)

            transcript_result = await engine.transcribe_file(file_path, progress_callback=transcribe_progress)
            if not transcript_result:
                video.status = "failed"
                video.error_message = "Transcription failed"
                analysis.status = "failed"
                await db.commit()
                return

            # Store transcript
            transcript_record = Transcript(
                video_id=vid_uuid,
                full_text=transcript_result.full_text,
                language=transcript_result.language,
                source="whisper",
                word_count=transcript_result.word_count,
                timestamps_json=[{"start": s.start, "end": s.end, "text": s.text} for s in transcript_result.segments],
            )
            db.add(transcript_record)
            video.status = "ready"
            await update_prog(100)

            # AI Synthesis
            word_count = transcript_result.word_count
            analysis.progress_percentage = 70
            est_seconds = 20 + int(word_count / 625)
            analysis.estimated_remaining_seconds = est_seconds
            await db.commit()

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
            analysis.progress_percentage = 100
            await db.commit()
            logger.info(f"Upload processing for video {video_id} completed")

        except Exception as e:
            logger.error(f"Upload processing failed: {e}", exc_info=True)
            try:
                video = await _get_video(db, UUID(video_id))
                analysis = await db.scalar(select(Analysis).where(Analysis.id == UUID(analysis_id)))
                if video:
                    video.status = "failed"
                    video.error_message = str(e)[:1000]
                if analysis:
                    analysis.status = "failed"
                    analysis.error_message = str(e)[:1000]
                await db.commit()
            except Exception:
                pass


async def process_document(
    ctx: dict,
    document_id: str,
    file_path: str,
    file_type: str,
):
    """Process an uploaded document: extract text → chunk → embed."""
    async with async_session_factory() as db:
        try:
            doc_uuid = UUID(document_id)
            document = await db.scalar(select(Document).where(Document.id == doc_uuid))
            if not document:
                logger.error(f"Document {document_id} not found")
                return

            document.status = "processing"
            await db.commit()

            # Extract text
            text = await _extract_text_from_file(file_path, file_type)
            if not text:
                document.status = "failed"
                document.error_message = f"Text extraction failed for {file_type}"
                await db.commit()
                return

            # Chunk and Embed
            chunks = chunk_transcript(text)  # reuse the same chunking logic
            chunk_texts = [c["text"] for c in chunks]
            embeddings = await generate_embeddings(chunk_texts)

            for chunk_data, embedding in zip(chunks, embeddings):
                chunk_record = DocumentChunk(
                    document_id=doc_uuid,
                    chunk_index=chunk_data["chunk_index"],
                    text=chunk_data["text"],
                    embedding=embedding if any(e != 0.0 for e in embedding) else None,
                )
                db.add(chunk_record)

            document.status = "ready"
            await db.commit()
            logger.info(f"Document {document_id} processed successfully")

        except Exception as e:
            logger.error(f"Document processing failed: {e}", exc_info=True)
            try:
                document = await db.scalar(select(Document).where(Document.id == UUID(document_id)))
                if document:
                    document.status = "failed"
                    document.error_message = str(e)[:1000]
                    await db.commit()
            except Exception:
                pass


async def _extract_text_from_file(file_path: str, file_type: str) -> str | None:
    """Helper to extract text based on file type. Handles missing optional dependencies gracefully."""
    try:
        if file_type == "pdf":
            try:
                from pypdf import PdfReader
            except ImportError:
                logger.error("pypdf not installed. Install with: pip install pypdf")
                return None
                
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
            
            # OCR Fallback if text is too short (likely a scanned document)
            if len(text.strip()) < 50:
                logger.info(f"PDF text extraction minimal ({len(text.strip())} chars). Attempting OCR...")
                try:
                    from pdf2image import convert_from_path
                    import pytesseract
                    
                    # Convert PDF to images
                    images = convert_from_path(file_path)
                    ocr_text = ""
                    for i, image in enumerate(images):
                        ocr_text += f"--- PAGE {i+1} ---\n"
                        ocr_text += pytesseract.image_to_string(image) + "\n"
                    
                    if len(ocr_text.strip()) > len(text.strip()):
                        return ocr_text.strip()
                except ImportError:
                    logger.warning("OCR dependencies not installed. Install with: pip install pytesseract pdf2image")
                except Exception as ocr_err:
                    logger.warning(f"OCR fallback failed: {ocr_err}")
            
            return text.strip()
            
        elif file_type == "docx":
            try:
                import docx
            except ImportError:
                logger.error("python-docx not installed. Install with: pip install python-docx")
                return None
            doc = docx.Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs]).strip()
            
        elif file_type == "txt":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read().strip()
                
        return None
    except Exception as e:
        logger.error(f"Extraction error for {file_path}: {e}")
        return None


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
    functions = [process_video_analysis, process_upload, process_document]
    
    # Use the Redis URL from settings
    from arq.connections import RedisSettings
    
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)

    # Memory optimization for 512MB Render tier:
    # Restrict to 1 concurrent analysis job at a time
    max_jobs = 1
    # Allow jobs to take up to 10 minutes max 
    job_timeout = 600

    @staticmethod
    async def on_startup(ctx):
        logger.info("ARQ worker started")

    @staticmethod
    async def on_shutdown(ctx):
        logger.info("ARQ worker stopped")
