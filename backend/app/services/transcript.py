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
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


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
    """Multi-stage transcript extraction with automatic fallback."""
    
    _whisper_model = None

    @classmethod
    def _get_whisper_model(cls):
        if cls._whisper_model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info("Loading Faster-Whisper 'base' model (int8)...")
                cls._whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
            except ImportError:
                import whisper
                logger.info("Faster-Whisper not found. Falling back to standard Whisper 'base' model...")
                cls._whisper_model = whisper.load_model("base")
        return cls._whisper_model

    MIN_WORD_COUNT = 50  # Quality gate: reject transcripts shorter than this

    async def extract(self, video_id: str) -> TranscriptResult:
        """Main entry: attempt all stages in order until one succeeds."""
        url = f"https://www.youtube.com/watch?v={video_id}"

        # Stage 1: youtube-transcript-api
        logger.info(f"DEBUG [{video_id}]: Stage 1 start...", )
        result = await self._try_transcript_api(video_id)
        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "youtube_transcript_api"
            logger.info(f"DEBUG [{video_id}]: Stage 1 success.", )
            return result

        # Stage 2: Manual captions
        logger.info(f"DEBUG [{video_id}]: Stage 2 start...", )
        result = await self._try_ytdlp_captions(url, auto=False)
        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "manual_captions"
            logger.info(f"DEBUG [{video_id}]: Stage 2 success.", )
            return result

        # Stage 3: Auto-generated captions
        logger.info(f"DEBUG [{video_id}]: Stage 3 start...", )
        result = await self._try_ytdlp_captions(url, auto=True)
        if result and result.word_count >= self.MIN_WORD_COUNT and not self._is_repetitive(result.segments):
            result.source = "auto_captions"
            logger.info(f"DEBUG [{video_id}]: Stage 3 success.", )
            return result

        # Stage 4: Groq Cloud Whisper (Fast, zero CPU)
        logger.info(f"DEBUG [{video_id}]: Stage 4 start (Groq Cloud)...", )
        result = await self._try_groq_whisper(url, video_id)
        if result and result.word_count >= self.MIN_WORD_COUNT:
            result.source = "groq_whisper"
            logger.info(f"DEBUG [{video_id}]: Stage 4 success.", )
            return result

        # Stage 5: Gemini Cloud (Fast, zero CPU)
        logger.info(f"DEBUG [{video_id}]: Stage 5 start (Gemini Cloud)...", )
        result = await self._try_gemini_whisper(url, video_id)
        if result and result.word_count >= self.MIN_WORD_COUNT:
            result.source = "gemini_cloud"
            logger.info(f"DEBUG [{video_id}]: Stage 5 success.", )
            return result

        # Stage 6: Local Whisper (Slow fallback)
        logger.info(f"DEBUG [{video_id}]: Stage 6 start (Local Whisper)...", )
        result = await self._try_whisper(url, video_id)
        if result and result.word_count >= self.MIN_WORD_COUNT:
            result.source = "local_whisper"
            logger.info(f"DEBUG [{video_id}]: Stage 6 success.", )
            return result

        # All stages failed
        logger.error(f"[{video_id}] ✗ All transcript extraction stages failed")
        raise TranscriptError(f"Could not extract transcript for video {video_id}")

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

    async def _try_groq_whisper(self, url: str, video_id: str) -> Optional[TranscriptResult]:
        """Download audio and transcribe with Groq Cloud Whisper API."""
        try:
            from app.config import get_settings
            settings = get_settings()
            if not settings.GROQ_API_KEY:
                logger.warning("GROQ_API_KEY not configured, skipping cloud transcription")
                return None

            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.m4a")

                # Download audio only (m4a is usually better for cloud APIs than low-quality mp3)
                cmd = [
                    "yt-dlp",
                    "-f", "ba[ext=m4a]/ba",  # Prefer m4a
                    "-x",
                    "--audio-format", "m4a",
                    "-o", audio_path,
                    "--no-warnings",
                    "--quiet",
                    url,
                ]

                proc = await _run_subprocess(cmd, timeout=300)
                if proc.returncode != 0:
                    logger.warning(f"yt-dlp failed for Groq stage with code {proc.returncode}")
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
                # 16khz, mono, 32k bitrate is plenty for Whisper and very small
                compressed_audio = os.path.join(tmpdir, f"{video_id}_comp.mp3")
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-i", actual_audio,
                    "-ar", "16000",
                    "-ac", "1",
                    "-map", "a",
                    "-b:a", "32k",
                    "-y",
                    compressed_audio
                ]
                
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

    async def _try_gemini_whisper(self, url: str, video_id: str) -> Optional[TranscriptResult]:
        """Download audio and transcribe with Google AI Gemini 1.5 Flash."""
        try:
            from app.config import get_settings
            settings = get_settings()
            if not settings.GOOGLE_AI_KEY:
                logger.warning("GOOGLE_AI_KEY not configured, skipping Gemini stage")
                return None

            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.mp3")

                # Download audio
                cmd = [
                    "yt-dlp",
                    "-x",
                    "--audio-format", "mp3",
                    "--audio-quality", "9",
                    "-o", audio_path,
                    "--no-warnings",
                    "--quiet",
                    url,
                ]

                proc = await _run_subprocess(cmd, timeout=300)
                if proc.returncode != 0:
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
        """Download audio and transcribe with OpenAI Whisper."""
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, f"{video_id}.mp3")

                # Download audio only
                cmd = [
                    "yt-dlp",
                    "-x",
                    "--audio-format", "mp3",
                    "--audio-quality", "5",  # Medium quality (sufficient for speech)
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
