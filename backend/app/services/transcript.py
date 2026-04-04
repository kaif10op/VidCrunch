"""
Multi-stage transcript extraction engine.

Pipeline:
  Stage 1: yt-dlp manual captions (most reliable)
  Stage 2: yt-dlp auto-generated captions
  Stage 3: Audio download → Whisper transcription (fallback)
"""

import json
import logging
import asyncio
import sys
import subprocess
import requests
import tempfile
import httpx
from http.cookiejar import MozillaCookieJar
from app.config import get_settings
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger(__name__)
import os
import re

settings = get_settings()

@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass
class TranscriptResult:
    full_text: str
    segments: list[TranscriptSegment] = field(default_factory=list)
    language: str = "en"
    source: str = "unknown"  # manual_captions, auto_captions, whisper
    word_count: int = 0


def _fetch_official_transcript_sync(vid: str, session: Optional[requests.Session]) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Standalone sync function to fetch transcripts, avoiding closure issues in threads."""
    from youtube_transcript_api import YouTubeTranscriptApi
    try:
        sys.stdout.write(f"\nDEBUG: Starting fetch for {vid}...\n")
        sys.stdout.flush()
        
        api = YouTubeTranscriptApi(http_client=session)
        t_list = api.list(vid)
        
        langs = ["en", "en-US", "en-GB", "hi", "hi-Latn"]
        try:
            t = t_list.find_transcript(langs)
            # Try to translate if non-English
            if t.language_code not in ["en", "en-US", "en-GB"]:
                try:
                    return t.translate("en").fetch(), "translated"
                except:
                    return t.fetch(), "auto"
            return t.fetch(), "official"
        except:
            # Fallback to first available
            for t in t_list:
                return t.fetch(), "auto"
        return None, None
    except Exception as e:
        sys.stderr.write(f"\nERROR: Transcript API sync call failed for {vid}: {e}\n")
        sys.stderr.flush()
        return None, None


class TranscriptEngine:
    """Multi-stage transcript extraction with automatic fallback and progress reporting."""
    
    _whisper_model = None
    _whisper_available = None  # Cache availability check
    _last_successful_client = "android" # Memoize client that bypasses blocks

    @classmethod
    def _check_whisper_available(cls) -> bool:
        """Check if whisper or faster-whisper is installed."""
        # Hard-disabled to prevent OOM errors on Render free tier (512MB limit)
        # Faster-Whisper requires minimum 1GB RAM to load the base int8 model.
        # We rely 100% on Cloud APIs (Groq/Gemini).
        cls._whisper_available = False
        return cls._whisper_available

    @classmethod
    def _get_whisper_model(cls):
        """Lazy-load Whisper model only when actually needed."""
        if cls._whisper_model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info("Loading Faster-Whisper 'base' model (int8)...")
                cls._whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
            except ImportError:
                try:
                    import whisper
                    logger.info("Faster-Whisper not found. Loading standard Whisper 'base' model...")
                    cls._whisper_model = whisper.load_model("base")
                except ImportError:
                    logger.error("No Whisper library available!")
                    return None
        return cls._whisper_model

    MIN_WORD_COUNT = 50  # Quality gate: reject transcripts shorter than this

    async def extract(
        self, 
        video_id: str, 
        progress_callback: Optional[callable] = None
    ) -> TranscriptResult:
        """
        Main entry: attempt stages in order until one succeeds.
        
        Args:
            video_id: YouTube video ID
            progress_callback: Optional async callback(stage: int, total: int, message: str)
        """
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        async def report(stage: int, total: int, msg: str):
            if progress_callback:
                try:
                    await progress_callback(stage, total, msg)
                except Exception:
                    pass

        # Success path handler
        async def process_result(res: TranscriptResult) -> TranscriptResult:
            if not res or not res.segments:
                return res
            
            # Sort by timestamp
            res.segments = sorted(res.segments, key=lambda x: x.start)
            # Logically group into professional paragraphs (Premium Reader)
            res.segments = self._group_segments(res.segments)
            # Update full text from grouped segments
            res.full_text = " ".join([s.text for s in res.segments])
            res.word_count = len(res.full_text.split())
            return res

        # Stage 1: youtube-transcript-api (fastest, most reliable)
        await report(1, 5, "Checking YouTube captions...")
        logger.info(f"[{video_id}] Stage 1: youtube-transcript-api")
        try:
            # Use wait_for to ensure the executor doesn't hang the worker indefinitely
            result = await asyncio.wait_for(self._try_transcript_api(video_id), timeout=12.0)
            if result and result.word_count >= 1 and not self._is_repetitive(result.segments):
                result.source = "youtube_transcript_api"
                result = await process_result(result)
                logger.info(f"[{video_id}] ✓ Stage 1 success ({result.word_count} words)")
                return result
        except asyncio.TimeoutError:
            logger.warning(f"[{video_id}] Stage 1 timed out after 12s. Moving to rescue lanes.")
        except Exception as e:
            logger.warning(f"[{video_id}] Stage 1 failed: {e}")

        # Stage 2: Aggressive Subtitle Rescue (Manual + Auto combined)
        # We try to get ANY captions available in one go to save process overhead
        await report(2, 5, "Subtitles rescue attempt...")
        logger.info(f"[{video_id}] Stage 2: Efficient subtitle rescue")
        
        # Try manual first, but keep the process open for auto if needed in internal logic
        result = await self._try_ytdlp_captions(url, auto=False)
        if not result or result.word_count < self.MIN_WORD_COUNT:
            result = await self._try_ytdlp_captions(url, auto=True)

        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "ytdlp_subtitles"
            result = await process_result(result)
            logger.info(f"[{video_id}] ✓ Stage 2 success ({result.word_count} words)")
            return result

        # Stage 3: Groq Cloud Whisper (FASTEST fallback)
        await report(3, 5, "AI transcription (Groq Whisper)...")
        logger.info(f"[{video_id}] Stage 3: Groq Cloud Whisper")
        cloud_result = await self._try_groq_whisper(url, video_id, report=report)
        if cloud_result and cloud_result.word_count >= self.MIN_WORD_COUNT:
            cloud_result = await process_result(cloud_result)
            logger.info(f"[{video_id}] ✓ Groq Whisper success ({cloud_result.word_count} words)")
            return cloud_result

        # Stage 4: Gemini Native Audio fallback
        await report(4, 5, "AI transcription (Gemini Ultra-Flash)...")
        logger.info(f"[{video_id}] Stage 4: Gemini Native Audio Analysis")
        cloud_result = await self._try_gemini_whisper(url, video_id, report=report)
        if cloud_result and cloud_result.word_count >= self.MIN_WORD_COUNT:
            cloud_result = await process_result(cloud_result)
            logger.info(f"[{video_id}] ✓ Gemini Audio success ({cloud_result.word_count} words)")
            return cloud_result

        # Stage 5: Local Whisper (last resort, slow)
        if self._check_whisper_available():
            await report(5, 5, "Local transcription (this may take a while)...")
            logger.info(f"[{video_id}] Stage 5: Local Whisper")
            result = await self._try_whisper(url, video_id)
            if result and result.word_count >= self.MIN_WORD_COUNT:
                result.source = "local_whisper"
                result = await process_result(result)
                logger.info(f"[{video_id}] ✓ Stage 5 success ({result.word_count} words)")
                await report(5, 5, "Success!")
                return result

        # All stages failed
        await report(6, 6, "All stages failed.")
        logger.error(f"[{video_id}] ✗ All transcript extraction stages failed")
        raise TranscriptError(f"Could not extract transcript for video {video_id}.")

    async def _try_cloud_transcription_parallel(self, url: str, video_id: str) -> Optional[TranscriptResult]:
        """Try Groq and Gemini cloud transcription in parallel, return first success."""
        import asyncio
        from app.config import get_settings
        settings = get_settings()
        
        tasks = []
        
        # Only add tasks for configured APIs
        if settings.GROQ_API_KEY:
            tasks.append(self._try_groq_whisper(url, video_id))
        if settings.GOOGLE_AI_KEY:
            tasks.append(self._try_gemini_whisper(url, video_id))
        
        if not tasks:
            logger.warning(f"[{video_id}] No cloud transcription APIs configured")
            return None
        
        # Race: return first successful result
        for coro in asyncio.as_completed(tasks):
            try:
                result = await coro
                if result and result.word_count >= self.MIN_WORD_COUNT:
                    return result
            except Exception as e:
                logger.debug(f"[{video_id}] Cloud transcription attempt failed: {e}")
                continue
        
        return None

    async def _try_transcript_api(self, video_id: str) -> Optional[TranscriptResult]:
        """Use youtube-transcript-api to fetch official YouTube transcripts (DRM-safe)."""
        cookies_path = "/app/cookies.txt"
        session = None
        
        # 1. PREPARE HIGH-TRUST SESSION
        if os.path.exists(cookies_path):
            try:
                # Ensure Netscape header
                with open(cookies_path, "r") as f: content = f.read()
                if content and not content.startswith("# Netscape"):
                    with open(cookies_path, "w") as f:
                        f.write("# Netscape HTTP Cookie File\n")
                        f.write(content)
                
                session = requests.Session()
                session.headers.update({
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                })
                cj = MozillaCookieJar(cookies_path)
                cj.load(ignore_discard=True, ignore_expires=True)
                session.cookies = cj
            except Exception as e:
                logger.warning(f"Session setup failed: {e}")
                session = None

        try:
            # 2. RUN IN EXECUTOR (Explicit parameter passing)
            loop = asyncio.get_event_loop()
            data_tuple = await loop.run_in_executor(None, _fetch_official_transcript_sync, video_id, session)
            
            if not data_tuple or not data_tuple[0]:
                return None
            
            data, source_type = data_tuple
            if not data: 
                return None

            segments = []
            full_text_parts = []
            for entry in data:
                # Handle both dictionary and object formats (FetchedTranscriptSnippet)
                text = getattr(entry, "text", entry.get("text", "") if isinstance(entry, dict) else "").replace("\n", " ").strip()
                start = float(getattr(entry, "start", entry.get("start", 0) if isinstance(entry, dict) else 0))
                duration = float(getattr(entry, "duration", entry.get("duration", 0) if isinstance(entry, dict) else 0))

                segments.append(TranscriptSegment(
                    start=start,
                    end=start + duration,
                    text=text
                ))
                full_text_parts.append(text)

            full_text = " ".join(full_text_parts)
            return TranscriptResult(
                full_text=full_text,
                segments=segments,
                language=source_type if source_type != "official" else "en",
                source=f"transcript_api_{source_type}",
                word_count=len(full_text.split())
            )
        except Exception as e:
            logger.error(f"Transcript API stage failed critically: {e}")
            return None

    def _is_repetitive(self, segments: List[TranscriptSegment]) -> bool:
        """Check if transcript segments are overly repetitive (bot detection signature)."""
        if len(segments) < 5:
            return False
            
        recent_texts = [s.text.strip().lower() for s in segments[:10]]
        for text in set(recent_texts):
            if recent_texts.count(text) > 5:
                return True
        return False

    def _segments_to_timestamped_text(self, segments: List[TranscriptSegment]) -> str:
        """Format segments into [MM:SS] text format."""
        lines = []
        for s in segments:
            m = int(s.start // 60)
            sec = int(s.start % 60)
            lines.append(f"[{m:02d}:{sec:02d}] {s.text}")
        return "\n".join(lines)

    async def _parallel_download_race(self, url: str, audio_path: str, clients: List[str], report: Optional[callable] = None) -> Tuple[Optional[str], Optional[subprocess.CompletedProcess], Optional[str]]:
        """Race multiple yt-dlp identities to bypass YouTube IP blocks."""
        import asyncio
        semaphore = asyncio.Semaphore(2)  # Max 2 parallel probes

        async def _probe(client_id):
            async with semaphore:
                try:
                    shard_path = f"{audio_path}.{client_id}.shard"
                    cmd = [
                        "yt-dlp",
                        "-x",
                        "--cookies", "/app/cookies.txt",
                        "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "--extractor-args", "youtube:player-client=mweb,web,safari",
                        "-f", "bestaudio/best",
                        "-o", shard_path,
                        "--no-warnings",
                        "--quiet",
                        url
                    ]
                    proc = await _run_subprocess(cmd, timeout=300)
                    if proc.returncode == 0 and os.path.exists(shard_path):
                        return client_id, proc, shard_path
                    return None
                except Exception:
                    return None

        tasks = [asyncio.create_task(_probe(c)) for c in clients]
        for coro in asyncio.as_completed(tasks):
            res = await coro
            if res:
                # Cancel other pending tasks
                for t in tasks:
                    if not t.done():
                        t.cancel()
                return res
        
        return None, None, None

    async def _transcribe_single_file(self, shard_path: str, video_id: str, settings, report=None) -> Optional[TranscriptResult]:
        """Transcribe a single file piece using Groq Cloud."""
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            with open(shard_path, "rb") as f:
                transcription = await asyncio.to_thread(
                    client.audio.transcriptions.create,
                    file=(os.path.basename(shard_path), f.read()),
                    model="whisper-large-v3-turbo",
                    response_format="verbose_json",
                )
                
                result_data = transcription.model_dump()
                full_text = result_data.get("text", "")
                segments_data = result_data.get("segments", [])
                
                segments = []
                for s in segments_data:
                    segments.append(TranscriptSegment(
                        start=float(s.get("start", 0)),
                        end=float(s.get("end", 0)),
                        text=s.get("text", "").strip(),
                    ))
                
                if not segments and full_text:
                    segments = [TranscriptSegment(start=0, end=0, text=full_text)]

                return TranscriptResult(
                    full_text=full_text,
                    segments=segments,
                    language=result_data.get("language", "en"),
                    word_count=len(full_text.split()),
                )
        except Exception as e:
            logger.warning(f"Groq shard transcription failed: {e}")
            return None

    async def _try_groq_whisper(self, url: str, video_id: str, report: Optional[callable] = None) -> Optional[TranscriptResult]:
        """Download audio and transcribe with Groq Whisper V3."""
        try:
            from app.config import get_settings
            settings = get_settings()
            if not settings.GROQ_API_KEY:
                logger.warning("GROQ_API_KEY not configured, skipping cloud transcription")
                return None

            if report: await report(4, 6, "Groq: Finding fastest bypass route...")
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.m4a")

                # --- FAST-LANE EXTRACTION (Parallel Probing) ---
                # Race TV and iOS first (most reliable bot-bypass)
                success_client, proc, downloaded_file = await self._parallel_download_race(url, audio_path, ["tv", "ios"], report)
                
                # If both failed, try Android and Web sequentially as last resort
                if not success_client:
                    if report: await report(4, 6, "Groq: Primary routes blocked, trying fallback identities...")
                    success_client, proc, downloaded_file = await self._parallel_download_race(url, audio_path, ["android", "mweb"], report)

                if not success_client or not proc or proc.returncode != 0:
                    err_msg = (proc.stderr or "All routes throttled").split("\n")[0] if proc else "All probes failed"
                    logger.warning(f"All yt-dlp attempts failed for Groq: {err_msg}")
                    if report: await report(4, 6, "Groq: YouTube is temporarily throttling this video")
                    return None
                
                actual_audio = None
                try:
                    import shutil
                    shutil.move(downloaded_file, audio_path)
                    actual_audio = audio_path
                except Exception as e:
                    logger.error(f"Failed to promote winning shard: {e}")
                    actual_audio = downloaded_file

                size_mb = os.path.getsize(actual_audio) / (1024 * 1024)
                logger.info(f"DEBUG [{video_id}]: Downloaded audio size: {size_mb:.2f} MB")

                # --- INTELLIGENT ROUTER ---
                if size_mb < 24.5:
                    logger.info(f"DEBUG [{video_id}]: Skipping compression (Turbo-Path active)")
                    return await self._transcribe_single_file(actual_audio, video_id, settings, report)

                logger.info(f"DEBUG [{video_id}]: File too large ({size_mb:.2f} MB), sharding for Scale...")
                if report: await report(4, 6, "Groq: Sharding 10+ hour context...")
                
                shards = await self._shard_audio(actual_audio, tmpdir)
                if not shards:
                    return await self._transcribe_with_compression(actual_audio, video_id, settings, report)

                if report: await report(4, 6, f"Groq: Transcribing {len(shards)} segments...")
                
                semaphore = asyncio.Semaphore(10)
                async def sem_transcribe(shard_path):
                    async with semaphore:
                        return await self._transcribe_single_file(shard_path, video_id, settings)

                tasks = [sem_transcribe(s) for s in shards]
                results = await asyncio.gather(*tasks)
                valid_results = [r for r in results if r]
                if not valid_results:
                    return None

                return self._combine_transcript_results(valid_results)
        except Exception as e:
            logger.warning(f"Groq Cloud transcription failed: {e}")
            return None

    async def _shard_audio(self, audio_path: str, tmpdir: str) -> list[str]:
        """Split audio into 15-minute shards using ffmpeg segmenter."""
        try:
            output_pattern = os.path.join(tmpdir, "shard_%03d.m4a")
            cmd = ["ffmpeg", "-i", audio_path, "-f", "segment", "-segment_time", "900", "-c", "copy", "-y", output_pattern]
            proc = await _run_subprocess(cmd, timeout=300)
            if proc.returncode != 0:
                return []
            shards = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.startswith("shard_") and f.endswith(".m4a")]
            return sorted(shards)
        except Exception as e:
            logger.error(f"Audio sharding failed: {e}")
            return []

    def _combine_transcript_results(self, results: list[TranscriptResult]) -> TranscriptResult:
        """Merge multiple transcript results into one, adjusting timestamps."""
        combined_segments = []
        current_offset = 0.0
        for res in results:
            for seg in res.segments:
                combined_segments.append(TranscriptSegment(start=seg.start + current_offset, end=seg.end + current_offset, text=seg.text))
            if res.segments:
                current_offset += res.segments[-1].end
            else:
                current_offset += 900.0
        full_text = self._segments_to_timestamped_text(combined_segments)
        return TranscriptResult(full_text=full_text, segments=combined_segments, language=results[0].language if results else "en", word_count=len(full_text.split()))

    async def _transcribe_with_compression(self, audio_path: str, video_id: str, settings, report=None) -> Optional[TranscriptResult]:
        """Fallback for large files: Compress heavily and try one-shot."""
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                comp_path = os.path.join(tmpdir, "comp.mp3")
                cmd = ["ffmpeg", "-i", audio_path, "-ar", "16000", "-ac", "1", "-b:a", "32k", "-y", comp_path]
                await _run_subprocess(cmd, timeout=300)
                if os.path.exists(comp_path):
                    return await self._transcribe_single_file(comp_path, video_id, settings, report)
            return None
        except: return None

    async def _try_gemini_whisper(self, url: str, video_id: str, report: Optional[callable] = None) -> Optional[TranscriptResult]:
        """Download audio and transcribe with Google AI Gemini 1.5 Flash."""
        try:
            from app.config import get_settings
            settings = get_settings()
            if not settings.GOOGLE_AI_KEY:
                logger.warning("GOOGLE_AI_KEY not configured, skipping Gemini stage")
                return None

            if report: await report(5, 6, "Gemini: Finding fastest bypass route...")
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.mp3")

                # --- FAST-LANE EXTRACTION (Parallel Probing) ---
                success_client, proc, downloaded_file = await self._parallel_download_race(url, audio_path, ["tv", "ios", "android"], report)

                if not success_client or not proc or proc.returncode != 0:
                    err_msg = (proc.stderr or "All routes throttled").split("\n")[0] if proc else "All probes failed"
                    logger.warning(f"All yt-dlp attempts failed for Gemini: {err_msg}")
                    if report: await report(5, 6, "Gemini: Download failed (YouTube Throttling)")
                    return None
                
                actual_audio = downloaded_file

                # Use Official Google SDK for reliable file upload and transcription
                import google.generativeai as genai
                genai.configure(api_key=settings.GOOGLE_AI_KEY)

                if report: await report(5, 6, "Gemini: Uploading audio...")
                logger.info(f"DEBUG [{video_id}]: Uploading to Gemini Files API...")
                
                import asyncio
                def _upload_file():
                    return genai.upload_file(path=actual_audio, mime_type="audio/mpeg")
                
                try:
                    uploaded_file = await asyncio.to_thread(_upload_file)
                    logger.info(f"DEBUG [{video_id}]: Gemini Upload success: {uploaded_file.uri}")
                except Exception as e:
                    logger.info(f"DEBUG [{video_id}]: Gemini Upload failed: {e}")
                    return None

                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = "Transcribe this audio file. Return the transcription as a list of objects with 'start' (seconds as float), 'end' (seconds as float), and 'text' fields."
                
                def _generate():
                    return model.generate_content([uploaded_file, prompt], generation_config=genai.GenerationConfig(response_mime_type="application/json", response_schema={"type": "object", "properties": {"transcription": {"type": "array", "items": {"type": "object", "properties": {"start": {"type": "number"}, "end": {"type": "number"}, "text": {"type": "string"}}, "required": ["start", "end", "text"]}}}, "required": ["transcription"]}))

                try:
                    if report: await report(5, 6, "Gemini: Transcribing...")
                    response = await asyncio.to_thread(_generate)
                    result_data = json.loads(response.text)
                    segments_data = result_data.get("transcription", [])
                    segments = [TranscriptSegment(start=float(s.get("start", 0)), end=float(s.get("end", 0)), text=s.get("text", "").strip()) for s in segments_data]
                    full_text = self._segments_to_timestamped_text(segments)
                    return TranscriptResult(full_text=full_text, segments=segments, language="en", word_count=len(full_text.split()))
                except Exception as e:
                    logger.info(f"DEBUG [{video_id}]: Gemini GenerateContent/Parse failed: {e}")
                    return None
                finally:
                    try:
                        def _delete_file(): genai.delete_file(uploaded_file.name)
                        await asyncio.to_thread(_delete_file)
                    except: pass
        except Exception as e:
            logger.warning(f"Gemini Cloud transcription failed: {e}")
            return None

    async def _try_ytdlp_captions(self, url: str, auto: bool = False) -> Optional[TranscriptResult]:
        """Extract captions using yt-dlp subtitle download."""
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                output_template = os.path.join(tmpdir, "subs")

                cmd = [
                    "yt-dlp",
                    "--skip-download",
                    "--sub-lang", "en,en-US,en-GB,hi,hi-Latn,en-orig,.*",
                    "--sub-format", "json3/srv3/vtt/srt/best",
                    "-o", output_template,
                    "--no-warnings",
                    "--quiet",
                    "--cookies", "/app/cookies.txt",
                    url,
                ]

                if auto:
                    cmd.insert(2, "--write-auto-sub")
                else:
                    cmd.insert(2, "--write-sub")

                proc = await _run_subprocess(cmd, timeout=60)

                if proc.returncode != 0:
                    return None

                # Find the subtitle file
                sub_file = None
                for f in os.listdir(tmpdir):
                    if f.endswith((".json3", ".srv3", ".vtt", ".srt")):
                        sub_file = os.path.join(tmpdir, f)
                        break

                if not sub_file:
                    return None

                # Parse subtitle file
                segments = self._parse_subtitle_file(sub_file)
                if not segments:
                    return None

                full_text = self._segments_to_timestamped_text(segments)
                word_count = len(full_text.split())

                # Detect language from filename
                language = "en"
                lang_match = re.search(r"\.([a-z]{2}(?:-[A-Z]{2})?)\.", os.path.basename(sub_file))
                if lang_match:
                    language = lang_match.group(1)

                return TranscriptResult(
                    full_text=full_text,
                    segments=segments,
                    language=language,
                    word_count=word_count,
                )
        except Exception as e:
            logger.warning(f"yt-dlp caption extraction failed: {e}")
            return None

    async def _try_whisper(self, url: str, video_id: str) -> Optional[TranscriptResult]:
        """Download audio and transcribe with local Whisper. Skips if Whisper not installed."""
        if not self._check_whisper_available():
            logger.info(f"[{video_id}] Skipping local Whisper (not installed)")
            return None
            
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.mp3")

                # Download audio only (lower quality for faster download)
                cmd = [
                    "yt-dlp",
                    "-x",
                    "--audio-format", "mp3",
                    "--audio-quality", "9",  # Lowest quality (sufficient for speech)
                    "-o", audio_path,
                    "--no-warnings",
                    "--quiet",
                    url,
                ]

                proc = await _run_subprocess(cmd, timeout=300)

                if proc.returncode != 0:
                    return None

                # Find the actual audio file (yt-dlp may add extension)
                actual_audio = None
                for f in os.listdir(tmpdir):
                    if f.endswith((".mp3", ".m4a", ".wav", ".opus", ".webm")):
                        actual_audio = os.path.join(tmpdir, f)
                        break

                if not actual_audio:
                    return None

                # Run Whisper
                return await self._transcribe_with_whisper(actual_audio)

        except Exception as e:
            logger.warning(f"Whisper transcription failed: {e}")
            return None

    async def _transcribe_with_whisper(self, audio_path: str) -> Optional[TranscriptResult]:
        """Run Whisper on audio file."""
        try:
            import asyncio
            model = self._get_whisper_model()
            if model is None:
                return None
            
            # Check if it's faster-whisper or standard whisper
            is_faster_whisper = getattr(model.__class__, "__module__", "").startswith("faster_whisper")
            
            if is_faster_whisper:
                # model.transcribe is a generator/iterator in faster-whisper
                # we need to run the iteration in a thread
                def _run_faster_whisper():
                    segments_iter, info = model.transcribe(audio_path, beam_size=2)
                    return list(segments_iter), info

                segments, info = await asyncio.to_thread(_run_faster_whisper)
                
                results = []
                for s in segments:
                    results.append(TranscriptSegment(
                        start=s.start,
                        end=s.end,
                        text=s.text.strip(),
                    ))
                
                results = self._group_segments(results)
                language = info.language
            else: # standard whisper
                # result = model.transcribe(audio_path, verbose=False)
                result = await asyncio.to_thread(model.transcribe, audio_path, verbose=False)
                results = []
                for seg in result.get("segments", []):
                    results.append(TranscriptSegment(
                        start=seg["start"],
                        end=seg["end"],
                        text=seg["text"].strip(),
                    ))
                language = result.get("language", "en")

            full_text = self._segments_to_timestamped_text(results)
            return TranscriptResult(
                full_text=full_text,
                segments=results,
                language=language,
                word_count=len(full_text.split()),
            )
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return None

    def _sentencize_text(self, text: str) -> str:
        """Heuristically punctuate, capitalize and clean unformatted word streams."""
        if not text: return ""
        
        # 1. CLEANING: Remove noisy speaker markers like >> and stray junk
        text = text.replace(">>", "").replace(" ara ", " ").strip()
        
        # 2. SENTENCIZATION: Handle basic punctuation and capitalization
        # If no punctuation at all, capitalize first char and add a period to the end
        if not any(c in text for c in {'.', '!', '?', '।'}):
            if len(text) > 2:
                # Capitalize first letter
                text = text[0].upper() + text[1:]
                # Add period
                text = text + "."
        return text

    def _group_segments(self, segments: list[TranscriptSegment], max_duration: float = 30.0, max_words: int = 60) -> list[TranscriptSegment]:
        """Group transcript snippets into professional, human-readable paragraphs."""
        if not segments: return []
        
        grouped = []
        current_group_texts = []
        group_start = segments[0].start
        
        for i, s in enumerate(segments):
            current_group_texts.append(s.text.strip())
            current_end = s.end
            
            combined_text = " ".join(current_group_texts).strip()
            duration = current_end - group_start
            word_count = len(combined_text.split())
            
            # Sentence end detection (., !, ?, । for Hindi)
            last_char = combined_text[-1] if combined_text else ""
            is_sentence_end = last_char in {'.', '!', '?', '।'}
            
            # Smart-Break Narrative Logic:
            # 1. Last segment in the list
            # 2. Reached narrative limits (30s or 60 words) for efficient human skimmability
            # 3. Natural sentence break found after a reasonable minimum duration (12s)
            if (i == len(segments) - 1) or \
               (duration >= max_duration) or \
               (word_count >= max_words) or \
               (is_sentence_end and duration >= 12.0):
                
                # Apply Sentencizer to the combined block
                final_text = self._sentencize_text(combined_text)
                
                grouped.append(TranscriptSegment(
                    start=group_start,
                    end=current_end,
                    text=final_text
                ))
                
                if i < len(segments) - 1:
                    current_group_texts = []
                    group_start = segments[i+1].start
                    
        return grouped

    async def transcribe_file(
        self,
        file_path: str,
        progress_callback: Optional[callable] = None
    ) -> TranscriptResult:
        """
        Transcribe an uploaded audio/video file.
        
        Tries cloud APIs first (fast), then falls back to local Whisper.
        
        Args:
            file_path: Path to audio/video file
            progress_callback: Optional async callback(stage: int, total: int, message: str)
        """
        async def report(stage: int, total: int, msg: str):
            if progress_callback:
                try:
                    await progress_callback(stage, total, msg)
                except Exception:
                    pass

        video_id = "upload"
        
        # Try Groq Cloud first (fast)
        await report(1, 3, "Transcribing with cloud AI...")
        if settings.GROQ_API_KEY:
            logger.info(f"[upload] Trying Groq cloud transcription...")
            result = await self._transcribe_file_with_groq(file_path)
            if result and result.word_count >= self.MIN_WORD_COUNT:
                result.source = "groq_cloud"
                logger.info(f"[upload] ✓ Groq cloud success ({result.word_count} words)")
                return result

        # Try Gemini Cloud
        await report(2, 3, "Trying alternative cloud AI...")
        if settings.GOOGLE_AI_KEY:
            logger.info(f"[upload] Trying Gemini cloud transcription...")
            result = await self._transcribe_file_with_gemini(file_path)
            if result and result.word_count >= self.MIN_WORD_COUNT:
                result.source = "gemini_cloud"
                logger.info(f"[upload] ✓ Gemini cloud success ({result.word_count} words)")
                return result

        # Fall back to local Whisper
        if self._check_whisper_available():
            await report(3, 3, "Using local transcription...")
            logger.info(f"[upload] Falling back to local Whisper...")
            result = await self._transcribe_with_whisper(file_path)
            if result and result.word_count >= self.MIN_WORD_COUNT:
                result.source = "local_whisper"
                logger.info(f"[upload] ✓ Local Whisper success ({result.word_count} words)")
                return result

        raise TranscriptError("Could not transcribe the uploaded file. Check your API keys or install Whisper.")

    async def _transcribe_file_with_groq(self, file_path: str) -> Optional[TranscriptResult]:
        """Transcribe an audio file using Groq Whisper API."""
        try:
            if not settings.GROQ_API_KEY:
                return None

            # Check file size
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            if size_mb > 25:
                logger.info(f"[upload] File too large for Groq ({size_mb:.2f} MB)")
                return None

            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            with open(file_path, "rb") as f:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(file_path), f.read()),
                    model="whisper-large-v3-turbo",
                    response_format="verbose_json",
                )
                
                result_data = transcription.model_dump()
                full_text = result_data.get("text", "")
                segments_data = result_data.get("segments", [])
                
                segments = []
                for s in segments_data:
                    segments.append(TranscriptSegment(
                        start=float(s.get("start", 0)),
                        end=float(s.get("end", 0)),
                        text=s.get("text", "").strip(),
                    ))

                if not segments and full_text:
                    segments = [TranscriptSegment(start=0, end=0, text=full_text)]

                return TranscriptResult(
                    full_text=self._segments_to_timestamped_text(segments),
                    segments=segments,
                    language=result_data.get("language", "en"),
                    word_count=len(full_text.split()),
                )
        except Exception as e:
            logger.warning(f"Groq file transcription failed: {e}")
            return None

    async def _transcribe_file_with_gemini(self, file_path: str) -> Optional[TranscriptResult]:
        """Transcribe an audio file using Google Gemini API."""
        try:
            if not settings.GOOGLE_AI_KEY:
                return None

            import base64
            import mimetypes
            
            # Read file
            with open(file_path, "rb") as f:
                audio_data = f.read()
            
            # Encode as base64
            audio_b64 = base64.standard_b64encode(audio_data).decode("utf-8")
            mime_type = mimetypes.guess_type(file_path)[0] or "audio/mpeg"

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GOOGLE_AI_KEY}"
            
            payload = {
                "contents": [{
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": audio_b64
                            }
                        },
                        {
                            "text": "Transcribe this audio. Output ONLY the spoken words, no commentary. Include timestamps in [MM:SS] format where appropriate."
                        }
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 8192
                }
            }

            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    logger.warning(f"Gemini API error: {resp.status_code}")
                    return None

                data = resp.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                if not text:
                    return None

                return TranscriptResult(
                    full_text=text.strip(),
                    segments=[TranscriptSegment(start=0, end=0, text=text.strip())],
                    language="en",
                    word_count=len(text.split()),
                )

        except Exception as e:
            logger.warning(f"Gemini file transcription failed: {e}")
            return None

    def _parse_subtitle_file(self, filepath: str) -> list[TranscriptSegment]:
        """Parse various subtitle formats into segments."""
        content = open(filepath, "r", encoding="utf-8").read()
        ext = os.path.splitext(filepath)[1].lower()

        if ext == ".json3":
            return self._parse_json3(content)
        elif ext == ".srv3":
            return self._parse_srv3(content)
        elif ext in (".vtt", ".srt"):
            return self._parse_vtt_srt(content)
        else:
            return self._parse_vtt_srt(content)  # Try VTT as default

    def _parse_json3(self, content: str) -> list[TranscriptSegment]:
        """Parse YouTube json3 subtitle format."""
        try:
            data = json.loads(content)
            segments = []
            for event in data.get("events", []):
                if "segs" not in event:
                    continue
                start_ms = event.get("tStartMs", 0)
                duration_ms = event.get("dDurationMs", 0)
                text = "".join(s.get("utf8", "") for s in event["segs"]).strip()
                text = text.replace("\n", " ")
                if text and text != "\n":
                    segments.append(TranscriptSegment(
                        start=start_ms / 1000.0,
                        end=(start_ms + duration_ms) / 1000.0,
                        text=text,
                    ))
            return segments
        except Exception:
            return []

    def _parse_srv3(self, content: str) -> list[TranscriptSegment]:
        """Parse YouTube srv3 (XML-based) subtitle format."""
        segments = []
        pattern = r'<text start="([\d.]+)".*?dur="([\d.]+)".*?>(.*?)</text>'
        for match in re.finditer(pattern, content, re.DOTALL):
            start = float(match.group(1))
            dur = float(match.group(2))
            text = match.group(3)
            text = re.sub(r"<[^>]+>", "", text)  # Strip HTML
            text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            text = text.replace("&#39;", "'").replace("&quot;", '"')
            text = text.strip()
            if text:
                segments.append(TranscriptSegment(start=start, end=start + dur, text=text))
        return segments

    def _parse_vtt_srt(self, content: str) -> list[TranscriptSegment]:
        """Parse VTT/SRT subtitle formats."""
        segments = []
        # Match timestamp lines: 00:00:01.000 --> 00:00:05.000
        pattern = r"(\d+:?\d+:\d+[\.,]\d+)\s*-->\s*(\d+:?\d+:\d+[\.,]\d+)\s*\n(.*?)(?=\n\n|\n\d+\n|\Z)"
        for match in re.finditer(pattern, content, re.DOTALL):
            start = self._parse_timestamp(match.group(1))
            end = self._parse_timestamp(match.group(2))
            text = re.sub(r"<[^>]+>", "", match.group(3)).strip()
            text = text.replace("\n", " ")
            if text:
                segments.append(TranscriptSegment(start=start, end=end, text=text))
        return segments

    def _parse_timestamp(self, ts: str) -> float:
        """Convert a timestamp string to seconds."""
        ts = ts.replace(",", ".")
        parts = ts.split(":")
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return 0.0

    def _segments_to_timestamped_text(self, segments: list[TranscriptSegment]) -> str:
        """
        Convert segments to timestamped text format: [MM:SS] text.
        Merges short segments into ~10 second blocks for better readability.
        """
        if not segments:
            return ""

        merged_lines = []
        current_text = []
        current_start = segments[0].start
        
        for i, seg in enumerate(segments):
            current_text.append(seg.text)
            
            # Check if we should emit the line (every ~10s or if it's the last segment)
            is_last = (i == len(segments) - 1)
            duration = seg.end - current_start
            
            if duration >= 10.0 or is_last:
                mins = int(current_start // 60)
                secs = int(current_start % 60)
                full_line = " ".join(current_text).strip()
                if full_line:
                    merged_lines.append(f"[{mins}:{secs:02d}] {full_line}")
                
                # Reset for next block
                if not is_last:
                    current_text = []
                    current_start = segments[i+1].start if i+1 < len(segments) else seg.end
                    
        return "\n".join(merged_lines)

    def _is_repetitive(self, segments: list[TranscriptSegment]) -> bool:
        """Detect if the transcript is mostly repetitive boilerplate (hallucinations)."""
        if not segments:
            return False
            
        from collections import Counter
        # Normalize text for counting
        normalized = [s.text.strip().lower() for s in segments if s.text.strip()]
        if not normalized:
            return False
            
        counts = Counter(normalized)
        if not counts:
            return False
            
        most_common_text, count = counts.most_common(1)[0]
        
        # Thresholds:
        # 1. If a single phrase takes up > 50% of a non-trivial transcript
        # 2. If a single phrase repeats > 10 times in any transcript
        total = len(normalized)
        if total > 5 and (count / total) > 0.5:
            logger.warning(f"Repetitive transcript detected: '{most_common_text}' repeated {count}/{total} times")
            return True
            
        if count > 12: # Hard limit for any repetition
            logger.warning(f"Highly repetitive phrase detected: '{most_common_text}' repeated {count} times")
            return True
            
        return False



class TranscriptError(Exception):
    pass


async def extract_metadata(video_id: str) -> dict:
    """Unstoppable Deep-Scrape Metadata Extraction engine."""
    # Lane 1: yt-dlp with Identity Jitter (Primary)
    try:
        import random
        client_name = random.choice(["web", "mweb", "safari", "ios", "android"])
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-warnings",
            "--quiet",
            "--cookies", "/app/cookies.txt",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "--extractor-args", f"youtube:player-client={client_name}",
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        proc = await _run_subprocess(cmd, timeout=20)
        if proc.returncode == 0:
            data = json.loads(proc.stdout)
            if data.get("title") and data.get("title").lower() != "unknown":
                return _parse_ytdlp_metadata(data)
    except Exception as e:
        logger.warning(f"Metadata Lane 1 (yt-dlp) failed for {video_id}: {e}")

    # Lane 3: Hard-HTML Deep-Scrape (Final Resort / UNSTOPPABLE)
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        # Load Cookies for Authenticated Scrape
        cookies = {}
        cookie_path = "/app/cookies.txt"
        if os.path.exists(cookie_path):
            with open(cookie_path, "r") as f:
                for line in f:
                    if not line.startswith("#") and "\t" in line:
                        parts = line.split("\t")
                        if len(parts) >= 7:
                            cookies[parts[5].strip()] = parts[6].strip()
        
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, cookies=cookies) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                html_content = resp.text
                
                # Multi-Signature Extraction
                title = None
                desc = None
                
                # 1. OG Tags
                title_match = re.search(r'<meta property="og:title" content="([^"]+)">', html_content)
                desc_match = re.search(r'<meta property="og:description" content="([^"]+)">', html_content)
                if title_match: title = title_match.group(1)
                if desc_match: desc = desc_match.group(1)
                
                # 2. Schema.org JSON-LD (Robust fallback)
                if not title:
                     json_ld = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', html_content)
                     if json_ld:
                         try:
                             ld_data = json.loads(json_ld.group(1).strip())
                             title = ld_data.get("name")
                             desc = ld_data.get("description")
                         except: pass
                
                # 3. Twitter Tags
                if not title:
                    t_match = re.search(r'<meta name="twitter:title" content="([^"]+)">', html_content)
                    if t_match: title = t_match.group(1)
                
                # 4. ytInitialPlayerResponse JSON (THE HIGH-TRUST LANE)
                if not title or duration == 0:
                    # More robust regex for ytInitialPlayerResponse
                    j_patterns = [
                        r'ytInitialPlayerResponse\s*=\s*({.+?});',
                        r'ytInitialPlayerResponse\s*=\s*({.+?})\s*</script>',
                        r'window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});'
                    ]
                    for jp in j_patterns:
                        json_match = re.search(jp, html_content)
                        if json_match:
                            try:
                                player_data = json.loads(json_match.group(1))
                                video_details = player_data.get("videoDetails", {})
                                title = video_details.get("title", title)
                                duration = int(video_details.get("lengthSeconds", duration))
                                thumbnail_url = video_details.get("thumbnail", {}).get("thumbnails", [{"url": thumbnail_url}])[-1].get("url")
                                logger.info(f"Metadata Lane 3 (JSON-Scrape) Success: {title} ({duration}s)")
                                break
                            except: pass

                # 5. Schema.org / OpenGraph / Twitter Fallbacks
                if not title:
                    og_match = re.search(r'<meta property="og:title" content="([^"]+)">', html_content)
                    if og_match: title = og_match.group(1)
                if not title:
                    item_match = re.search(r'<link itemprop="name" content="([^"]+)">', html_content)
                    if item_match: title = item_match.group(1)
                
                # 6. Raw Title Tag Fallback
                if not title:
                    r_match = re.search(r'<title>([^<]+)</title>', html_content)
                    if r_match: title = r_match.group(1).replace(" - YouTube", "")
                
                title = title or "YouTube Video"
                desc = desc or "Metadata analysis triggered (Description unavailable)."
                
                # Unescape HTML entities
                import html as html_lib
                title = html_lib.unescape(title)
                desc = html_lib.unescape(desc)

                logger.info(f"Metadata Lane 3 (Total Spectrum) Status: {title}")
                
                # CHAPTER EXTRACTION: Parse description for timestamps
                chapters = []
                # Match 00:00, 1:23, 01:23:45 format
                ts_pattern = r"((?:\d+:)?\d+:\d+)\s+[-–—: \t]*\s*(.+)"
                for ts_match in re.finditer(ts_pattern, desc):
                    chapters.append({
                        "time": ts_match.group(1),
                        "label": ts_match.group(2).strip()
                    })

                return {
                    "title": title,
                    "description": desc[:5000],
                    "channel": "YouTube Artist",
                    "duration_seconds": duration or 60,
                    "view_count": 0,
                    "like_count": 0,
                    "thumbnail_url": thumbnail_url or f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg",
                    "published_at": None,
                    "language": "en",
                    "chapters": chapters
                }
    except Exception as e:
        logger.error(f"Metadata Lane 3 (Deep-Scrape) absolute failure for {video_id}: {e}")

    return {"title": "Unknown", "channel": "Unknown", "chapters": []}


def _parse_ytdlp_metadata(data: dict) -> dict:
    """Helper to parse yt-dlp JSON dump."""
    from datetime import datetime
    published_at = None
    upload_date = data.get("upload_date")
    if upload_date and len(upload_date) == 8:
        try:
            published_at = datetime.strptime(upload_date, "%Y%m%d")
        except: pass
    
    return {
        "title": data.get("title", "Unknown"),
        "channel": data.get("uploader", data.get("channel", "Unknown")),
        "description": (data.get("description") or "")[:5000],
        "duration_seconds": data.get("duration", 0),
        "view_count": data.get("view_count", 0),
        "like_count": data.get("like_count", 0),
        "thumbnail_url": data.get("thumbnail", ""),
        "published_at": published_at,
        "language": data.get("language", "en"),
        "chapters": [{"time": _format_timestamp(c.get("start_time", 0)), "label": c.get("title", "Chapter")} for c in data.get("chapters", [])]
    }

def _format_timestamp(seconds: float) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0: return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


async def extract_playlist_ids(playlist_url: str) -> list[str]:
    """Extract all video IDs from a YouTube playlist."""
    try:
        cmd = [
            "yt-dlp",
            "--flat-playlist",
            "--print", "id",
            "--no-warnings",
            "--quiet",
            playlist_url,
        ]

        proc = await _run_subprocess(cmd, timeout=60)

        if proc.returncode != 0:
            return []

        return [line.strip() for line in proc.stdout.strip().split("\n") if line.strip()]
    except Exception as e:
        logger.error(f"Playlist extraction failed: {e}")
        return []


    async def _parallel_download_race(self, url: str, base_path: str, clients: list[str], report=None) -> tuple[Optional[str], Optional[subprocess.CompletedProcess], Optional[str]]:
        """Race multiple YouTube clients in parallel to bypass blocks. Returns (success_client, proc, file_path)."""
        import asyncio
        
        async def probe_client(client_name):
            # Give each probe its own unique file within the same directory as base_path
            dir_name = os.path.dirname(base_path)
            file_name = os.path.basename(base_path)
            sharded_path = os.path.join(dir_name, f"shard_{client_name}_{file_name}")
            
            cmd = self._get_ytdlp_args(url, sharded_path, client_name)
            res = await _run_subprocess(cmd, timeout=300)
            if res.returncode == 0:
                return client_name, res, sharded_path
            return client_name, None, sharded_path

        # Race the provided clients
        tasks = [asyncio.create_task(probe_client(c)) for c in clients]
        
        success_client = None
        success_proc = None
        success_path = None
        
        while tasks:
            done, tasks = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for completed_task in done:
                c_name, res, s_path = completed_task.result()
                if res and not success_client:
                    success_client = c_name
                    success_proc = res
                    success_path = s_path
                    for t in tasks: t.cancel()
                    break
        
        for c in clients:
            if c == success_client: continue
            try:
                dir_name = os.path.dirname(base_path)
                file_name = os.path.basename(base_path)
                path = os.path.join(dir_name, f"shard_{c}_{file_name}")
                if os.path.exists(path):
                    os.remove(path)
            except: pass
            
        return success_client, success_proc, success_path

    def _get_ytdlp_args(self, url: str, audio_path: str, client_type: str = "android") -> list[str]:
        """Get yt-dlp arguments for different player clients with resilient format selection."""
        args = [
            "yt-dlp",
            "-f", "ba[ext=m4a]/ba/bestaudio/best",
            "-x",
            "--audio-format", "m4a",
            "-o", audio_path,
            "--no-warnings",
            "--quiet",
            "--no-playlist",
            "--flat-playlist",
            "--ignore-errors",
            "--no-cache-dir",
            "--rm-cache-dir",
            "--no-check-certificate",
            "--prefer-insecure",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "--extractor-args", f"youtube:player_client={client_type}",
            url,
        ]
        
        cookies_path = "/app/cookies.txt"
        if os.path.exists(cookies_path):
            args.insert(-1, "--cookies")
            args.insert(-1, cookies_path)
            
        return args

class TranscriptError(Exception):
    pass




async def extract_playlist_ids(playlist_url: str) -> list[str]:
    """Extract all video IDs from a YouTube playlist."""
    try:
        cmd = [
            "yt-dlp",
            "--flat-playlist",
            "--print", "id",
            "--no-warnings",
            "--quiet",
            playlist_url,
        ]

        proc = await _run_subprocess(cmd, timeout=60)

        if proc.returncode != 0:
            return []

        return [line.strip() for line in proc.stdout.strip().split("\n") if line.strip()]
    except Exception as e:
        logger.error(f"Playlist extraction failed: {e}")
        return []

async def _run_subprocess(cmd: list[str], timeout: int = 60) -> subprocess.CompletedProcess:
    """Run a subprocess asynchronously."""
    import asyncio
    
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=process.returncode or 0,
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace")
        )
    except asyncio.TimeoutError:
        try:
            process.kill()
        except:
            pass
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=-1,
            stdout="",
            stderr="Subprocess timed out"
        )
    # Alias for structural compatibility
    def get_video_info(self, *args, **kwargs):
        """Legacy alias for extract_metadata."""
        from app.services.transcript import extract_metadata
        return extract_metadata(*args, **kwargs)

# Global aliases for legacy support
async def extract_metadata(platform_id: str) -> dict:
    """Consolidated logic for getting video details and chapters."""
    from app.services.transcript import _fetch_video_info_internal
    return await _fetch_video_info_internal(platform_id)

async def get_video_info(platform_id: str) -> dict:
    """Legacy global alias for extract_metadata."""
    return await extract_metadata(platform_id)
