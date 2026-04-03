"""
Multi-stage transcript extraction engine.

Pipeline:
  Stage 1: yt-dlp manual captions (most reliable)
  Stage 2: yt-dlp auto-generated captions
  Stage 3: Audio download → Whisper transcription (fallback)
"""

import json
import logging

logger = logging.getLogger(__name__)
import os
import re
import subprocess
import tempfile
import httpx
from app.config import get_settings
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

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


class TranscriptEngine:
    """Multi-stage transcript extraction with automatic fallback and progress reporting."""
    
    _whisper_model = None
    _whisper_available = None  # Cache availability check

    @classmethod
    def _check_whisper_available(cls) -> bool:
        """Check if any Whisper library is available and not disabled by settings."""
        if settings.DISABLE_LOCAL_WHISPER:
            return False
            
        if cls._whisper_available is not None:
            return cls._whisper_available
        try:
            from faster_whisper import WhisperModel
            cls._whisper_available = True
        except ImportError:
            try:
                import whisper
                cls._whisper_available = True
            except ImportError:
                cls._whisper_available = False
                logger.info("No Whisper library available. Local transcription disabled.")
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

        # Stage 1: youtube-transcript-api (fastest, most reliable)
        await report(1, 6, "Checking YouTube captions...")
        logger.info(f"[{video_id}] Stage 1: youtube-transcript-api")
        result = await self._try_transcript_api(video_id)
        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "youtube_transcript_api"
            logger.info(f"[{video_id}] ✓ Stage 1 success ({result.word_count} words)")
            return result

        # Stage 2: Manual captions via yt-dlp
        await report(2, 6, "Checking manual subtitles...")
        logger.info(f"[{video_id}] Stage 2: yt-dlp manual captions")
        result = await self._try_ytdlp_captions(url, auto=False)
        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "manual_captions"
            logger.info(f"[{video_id}] ✓ Stage 2 success ({result.word_count} words)")
            return result

        # Stage 3: Auto-generated captions via yt-dlp
        await report(3, 6, "Checking auto-generated subtitles...")
        logger.info(f"[{video_id}] Stage 3: yt-dlp auto captions")
        result = await self._try_ytdlp_captions(url, auto=True)
        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "auto_captions"
            logger.info(f"[{video_id}] ✓ Stage 3 success ({result.word_count} words)")
            return result

        # Stage 4 & 5: Cloud transcription (Gemini Flash Native Audio - FAST & FREE)
        logger.info(f"[{video_id}] Stage 4: Gemini Native Audio Analysis")
        
        # Try Gemini Flash with its native audio processing
        cloud_result = await self._try_gemini_whisper(url, video_id, report=report)
        if cloud_result and cloud_result.word_count >= self.MIN_WORD_COUNT:
            logger.info(f"[{video_id}] ✓ Gemini Audio success ({cloud_result.word_count} words)")
            return cloud_result

        # Stage 5: Groq fallback
        logger.info(f"[{video_id}] Stage 5: Groq fallback")
        cloud_result = await self._try_groq_whisper(url, video_id, report=report)
        if cloud_result and cloud_result.word_count >= self.MIN_WORD_COUNT:
            logger.info(f"[{video_id}] ✓ Groq Whisper success ({cloud_result.word_count} words)")
            return cloud_result

        # Stage 6: Local Whisper (last resort, slow)
        if self._check_whisper_available():
            await report(6, 6, "Local transcription (this may take a while)...")
            logger.info(f"[{video_id}] Stage 6: Local Whisper")
            result = await self._try_whisper(url, video_id)
            if result and result.word_count >= self.MIN_WORD_COUNT:
                result.source = "local_whisper"
                logger.info(f"[{video_id}] ✓ Stage 6 success ({result.word_count} words)")
                await report(6, 6, "Success!")
                return result
        elif settings.DISABLE_LOCAL_WHISPER:
            logger.info(f"[{video_id}] Stage 6 skipped (DISABLE_LOCAL_WHISPER=True)")
        else:
            logger.info(f"[{video_id}] Stage 6 skipped (Whisper not installed)")

        # All stages failed
        await report(6, 6, "All stages failed.")
        logger.error(f"[{video_id}] ✗ All transcript extraction stages failed")
        raise TranscriptError(f"Could not extract transcript for video {video_id}. Consider providing a different URL or checking your Cloud API keys.")

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
        """Use youtube-transcript-api to fetch official YouTube transcripts."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            import asyncio

            # Run the synchronous API in a thread pool
            def _fetch():
                api = YouTubeTranscriptApi()
                try:
                    transcript_list = api.list(video_id)
                except Exception as e:
                    logger.warning(f"Could not list transcripts for {video_id}: {e}")
                    return None
                
                try:
                    # Try manual English first
                    transcript = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
                except:
                    try:
                        # Try generated English
                        transcript = transcript_list.find_generated_transcript(["en", "en-US", "en-GB"])
                    except:
                        # Try any manual transcript and translate
                        for t in transcript_list:
                            if not t.is_generated:
                                try:
                                    return t.translate("en").fetch()
                                except:
                                    continue
                        
                        # Try any generated and translate
                        for t in transcript_list:
                            try:
                                return t.translate("en").fetch()
                            except:
                                continue
                        return None
                return transcript.fetch()

            data = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            if not data:
                return None

            segments = []
            for entry in data:
                segments.append(TranscriptSegment(
                    start=float(entry["start"]),
                    end=float(entry["start"] + entry["duration"]),
                    text=entry["text"].strip(),
                ))

            full_text = self._segments_to_timestamped_text(segments)
            word_count = len(full_text.split())

            return TranscriptResult(
                full_text=full_text,
                segments=segments,
                language="en",
                word_count=word_count,
            )
        except Exception as e:
            logger.warning(f"youtube-transcript-api failed: {e}")
            return None

    async def _try_groq_whisper(self, url: str, video_id: str, report: Optional[callable] = None) -> Optional[TranscriptResult]:
        """Download audio and transcribe with Groq Cloud Whisper API."""
        try:
            from app.config import get_settings
            settings = get_settings()
            if not settings.GROQ_API_KEY:
                logger.warning("GROQ_API_KEY not configured, skipping cloud transcription")
                return None

            if report: await report(5, 6, "Groq: Downloading audio...")
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.m4a")

                # Download audio only (Best available format)
                cmd = [
                    "yt-dlp",
                    "-f", "ba/b",  # Any working audio/video format
                    "-x",
                    "--audio-format", "m4a",
                    "-o", audio_path,
                    "--no-warnings",
                    "--quiet",
                    "--extractor-args", "youtube:player_client=android",
                    url,
                ]

                proc = await _run_subprocess(cmd, timeout=300)
                if proc.returncode != 0:
                    err_msg = (proc.stderr or "Unknown error").split("\n")[0]
                    logger.warning(f"yt-dlp failed for Groq stage: {err_msg}")
                    if report: await report(5, 6, f"Groq: Download failed ({err_msg[:30]})")
                    return None

                # Find the actual audio file
                actual_audio = None
                for f in os.listdir(tmpdir):
                    if f.endswith((".m4a", ".mp3", ".wav", ".opus", ".webm")):
                        actual_audio = os.path.join(tmpdir, f)
                        break

                if not actual_audio:
                    logger.warning("No audio file found after yt-dlp")
                    return None
                
                # Compress audio with ffmpeg to stay under Groq's 25MB limit
                # v3-turbo is faster and supports multilingual
                compressed_audio = os.path.join(tmpdir, f"{video_id}_comp.mp3")
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-i", actual_audio,
                    "-ar", "22050", # Standard sample rate
                    "-ac", "1",
                    "-b:a", "64k", # Standard bitrate
                    "-y",
                    compressed_audio
                ]
                if report: await report(5, 6, "Groq: Optimizing audio...")
                f_proc = await _run_subprocess(ffmpeg_cmd, timeout=300)
                if f_proc.returncode == 0 and os.path.exists(compressed_audio):
                    actual_audio = compressed_audio
                    logger.info(f"DEBUG [{video_id}]: ffmpeg compression successful.", )
                else:
                    logger.info(f"DEBUG [{video_id}]: ffmpeg compression failed (code {f_proc.returncode})", )

                size_mb = os.path.getsize(actual_audio) / (1024 * 1024)
                logger.info(f"DEBUG [{video_id}]: Uploading {os.path.basename(actual_audio)} to Groq ({size_mb:.2f} MB)", )

                if size_mb > 25:
                    logger.info(f"DEBUG [{video_id}]: File too large for Groq ({size_mb:.2f} MB), falling back", )
                    return None

                # Call Groq API using official SDK
                try:
                    if report: await report(5, 6, "Groq: Transcribing...")
                    from groq import Groq
                    client = Groq(api_key=settings.GROQ_API_KEY)
                    with open(actual_audio, "rb") as f:
                        transcription = client.audio.transcriptions.create(
                            file=(os.path.basename(actual_audio), f.read()),
                            model="whisper-large-v3-turbo",
                            response_format="verbose_json",
                        )
                        
                        # The transcription object has a .text and potentially .segments if response_format is verbose_json
                        # Note: The Groq SDK returns an object, not just a dict
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
                except Exception as sdk_err:
                    logger.info(f"DEBUG [{video_id}]: Groq SDK error: {sdk_err}", )
                    return None

        except Exception as e:
            logger.warning(f"Groq Cloud transcription failed: {e}")
            return None

    async def _try_gemini_whisper(self, url: str, video_id: str, report: Optional[callable] = None) -> Optional[TranscriptResult]:
        """Download audio and transcribe with Google AI Gemini 1.5 Flash."""
        try:
            from app.config import get_settings
            settings = get_settings()
            if not settings.GOOGLE_AI_KEY:
                logger.warning("GOOGLE_AI_KEY not configured, skipping Gemini stage")
                return None

            if report: await report(4, 6, "Gemini: Downloading audio...")
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.mp3")

                # Download audio
                cmd = [
                    "yt-dlp",
                    "-f", "ba/b",
                    "-x",
                    "--audio-format", "mp3",
                    "--audio-quality", "9",
                    "-o", audio_path,
                    "--no-warnings",
                    "--quiet",
                    "--extractor-args", "youtube:player_client=android",
                    url,
                ]

                proc = await _run_subprocess(cmd, timeout=300)
                if proc.returncode != 0:
                    err_msg = (proc.stderr or "Unknown error").split("\n")[0]
                    logger.warning(f"yt-dlp failed for Gemini stage: {err_msg}")
                    if report: await report(4, 6, f"Gemini: Download failed ({err_msg[:30]})")
                    return None

                actual_audio = None
                for f in os.listdir(tmpdir):
                    if f.endswith((".mp3", ".m4a", ".wav", ".opus", ".webm")):
                        actual_audio = os.path.join(tmpdir, f)
                        break

                if not actual_audio:
                    return None
                # Use Official Google SDK for reliable file upload and transcription
                import google.generativeai as genai
                genai.configure(api_key=settings.GOOGLE_AI_KEY)

                # 1. Upload to Files API
                if report: await report(4, 6, "Gemini: Uploading audio...")
                logger.info(f"DEBUG [{video_id}]: Uploading to Gemini Files API...", )
                
                # SDK doesn't support async upload yet, so run in thread
                import asyncio
                def _upload_file():
                    return genai.upload_file(path=actual_audio, mime_type="audio/mpeg")
                
                try:
                    uploaded_file = await asyncio.to_thread(_upload_file)
                    logger.info(f"DEBUG [{video_id}]: Gemini Upload success: {uploaded_file.uri}", )
                except Exception as e:
                    logger.info(f"DEBUG [{video_id}]: Gemini Upload failed: {e}", )
                    return None

                # 2. Generate content with structured output
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = "Transcribe this audio file. Return the transcription as a list of objects with 'start' (seconds as float), 'end' (seconds as float), and 'text' fields. Provide accurate timestamps for every sentence."
                
                def _generate():
                    return model.generate_content(
                        [uploaded_file, prompt],
                        generation_config=genai.GenerationConfig(
                            response_mime_type="application/json",
                            response_schema={
                                "type": "object",
                                "properties": {
                                    "transcription": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "start": {"type": "number"},
                                                "end": {"type": "number"},
                                                "text": {"type": "string"}
                                            },
                                            "required": ["start", "end", "text"]
                                        }
                                    }
                                },
                                "required": ["transcription"]
                            }
                        )
                    )

                try:
                    if report: await report(4, 6, "Gemini: Transcribing...")
                    response = await asyncio.to_thread(_generate)
                    result_data = json.loads(response.text)
                    segments_data = result_data.get("transcription", [])
                    
                    segments = []
                    for s in segments_data:
                        segments.append(TranscriptSegment(
                            start=float(s.get("start", 0)),
                            end=float(s.get("end", 0)),
                            text=s.get("text", "").strip(),
                        ))

                    full_text = self._segments_to_timestamped_text(segments)
                    return TranscriptResult(
                        full_text=full_text,
                        segments=segments,
                        language="en",
                        word_count=len(full_text.split()),
                    )
                except Exception as e:
                    logger.info(f"DEBUG [{video_id}]: Gemini GenerateContent/Parse failed: {e}", )
                    return None
                finally:
                    # Clean up file from Google Cloud (optional but good practice)
                    try:
                        def _delete_file():
                            genai.delete_file(uploaded_file.name)
                        await asyncio.to_thread(_delete_file)
                    except:
                        pass

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
                    "--sub-lang", "en,en-US,en-GB,hi,hi-Latn,en-orig,.*",  # Search everything, prefer English/Hindi
                    "--sub-format", "json3/srv3/vtt/srt/best",
                    "-o", output_template,
                    "--no-warnings",
                    "--quiet",
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
    """Extract video metadata using yt-dlp (no download)."""
    try:
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-warnings",
            "--quiet",
            f"https://www.youtube.com/watch?v={video_id}",
        ]

        proc = await _run_subprocess(cmd, timeout=30)

        if proc.returncode != 0:
            return {"title": "Unknown", "channel": "Unknown"}

        data = json.loads(proc.stdout)
        # Parse upload_date (YYYYMMDD) into datetime
        published_at = None
        upload_date = data.get("upload_date")
        if upload_date and len(upload_date) == 8:
            try:
                from datetime import datetime
                published_at = datetime.strptime(upload_date, "%Y%m%d")
            except Exception as e:
                logger.warning(f"Failed to parse upload_date {upload_date}: {e}")
                pass
        
        logger.info(f"DEBUG: published_at type={type(published_at)}, value={published_at}")

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
        }
    except Exception as e:
        logger.error(f"Metadata extraction failed: {e}")
        return {"title": "Unknown", "channel": "Unknown"}


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
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        return subprocess.CompletedProcess(cmd, 1, b"", b"Timeout")

    return subprocess.CompletedProcess(
        cmd,
        process.returncode or 0,
        stdout.decode("utf-8", errors="replace"),
        stderr.decode("utf-8", errors="replace"),
    )
