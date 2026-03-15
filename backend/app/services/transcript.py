"""
Multi-stage transcript extraction engine.

Pipeline:
  Stage 1: yt-dlp manual captions (most reliable)
  Stage 2: yt-dlp auto-generated captions
  Stage 3: Audio download → Whisper transcription (fallback)
"""

import json
import logging
import os
import re
import subprocess
import tempfile
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

    async def extract(self, video_id: str) -> TranscriptResult:
        """Main entry: attempt all stages in order until one succeeds."""
        url = f"https://www.youtube.com/watch?v={video_id}"

        # Stage 1: Manual captions via yt-dlp
        logger.info(f"[{video_id}] Stage 1: Trying manual captions...")
        result = await self._try_ytdlp_captions(url, auto=False)
        if result:
            result.source = "manual_captions"
            logger.info(f"[{video_id}] ✓ Manual captions extracted ({result.word_count} words)")
            return result

        # Stage 2: Auto-generated captions via yt-dlp
        logger.info(f"[{video_id}] Stage 2: Trying auto captions...")
        result = await self._try_ytdlp_captions(url, auto=True)
        if result:
            result.source = "auto_captions"
            logger.info(f"[{video_id}] ✓ Auto captions extracted ({result.word_count} words)")
            return result

        # Stage 2.5: Jina Reader API (web crawling fallback)
        logger.info(f"[{video_id}] Stage 2.5: Trying Jina Reader API...")
        result = await self._try_jina_reader(url, video_id)
        if result:
            result.source = "jina_reader"
            logger.info(f"[{video_id}] ✓ Jina Reader extracted ({result.word_count} words)")
            return result

        # Stage 3: Download audio → Whisper transcription
        logger.info(f"[{video_id}] Stage 3: Downloading audio for Whisper...")
        result = await self._try_whisper(url, video_id)
        if result:
            result.source = "whisper"
            logger.info(f"[{video_id}] ✓ Whisper transcription complete ({result.word_count} words)")
            return result

        # All stages failed
        logger.error(f"[{video_id}] ✗ All transcript extraction stages failed")
        raise TranscriptError(f"Could not extract transcript for video {video_id}")

    async def _try_ytdlp_captions(self, url: str, auto: bool = False) -> Optional[TranscriptResult]:
        """Extract captions using yt-dlp subtitle download."""
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                output_template = os.path.join(tmpdir, "subs")

                cmd = [
                    "yt-dlp",
                    "--skip-download",
                    "--sub-lang", "en,en-US,en-GB,en-orig",
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
        """Run OpenAI Whisper on audio file."""
        try:
            import whisper

            model = whisper.load_model("base")
            result = model.transcribe(
                audio_path,
                verbose=False,
                word_timestamps=False,
            )

            segments = []
            for seg in result.get("segments", []):
                segments.append(TranscriptSegment(
                    start=seg["start"],
                    end=seg["end"],
                    text=seg["text"].strip(),
                ))

            full_text = self._segments_to_timestamped_text(segments)
            word_count = len(full_text.split())
            language = result.get("language", "en")

            return TranscriptResult(
                full_text=full_text,
                segments=segments,
                language=language,
                word_count=word_count,
            )
        except ImportError:
            logger.warning("openai-whisper not installed. Whisper stage skipped.")
            return None
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
        """Convert segments to timestamped text format: [MM:SS] text"""
        lines = []
        for seg in segments:
            mins = int(seg.start // 60)
            secs = int(seg.start % 60)
            lines.append(f"[{mins}:{secs:02d}] {seg.text}")
        return "\n".join(lines)


    async def _try_jina_reader(self, url: str, video_id: str) -> Optional[TranscriptResult]:
        """Use Jina Reader API to crawl the YouTube page and extract transcript."""
        try:
            from app.config import get_settings
            import httpx

            settings = get_settings()
            if not settings.JINA_API_KEY:
                logger.info(f"[{video_id}] Jina API key not configured, skipping")
                return None

            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://r.jina.ai/{url}",
                    headers={
                        "Authorization": f"Bearer {settings.JINA_API_KEY}",
                        "X-Return-Format": "text",
                        "Accept": "text/plain",
                    },
                    timeout=30.0,
                )

                if resp.status_code != 200:
                    return None

                page_text = resp.text

                # Try to extract transcript-like content from the page
                # Look for timestamped lines [MM:SS] or (MM:SS) patterns
                lines = page_text.split("\n")
                transcript_lines = []
                for line in lines:
                    line = line.strip()
                    # Match lines with timestamps like 0:00, 1:23, 12:34
                    if re.match(r"^\d+:\d{2}", line):
                        transcript_lines.append(line)
                    elif re.match(r"^\[\d+:\d{2}\]", line):
                        transcript_lines.append(line)

                if len(transcript_lines) < 5:
                    # Not enough timestamped content, try extracting raw text
                    # Filter out navigation/UI text, keep substantial paragraphs
                    content_lines = [l for l in lines if len(l) > 50 and not l.startswith("#")]
                    if len(content_lines) > 3:
                        full_text = "\n".join(content_lines)
                        word_count = len(full_text.split())
                        if word_count > 100:
                            return TranscriptResult(
                                full_text=full_text,
                                segments=[],
                                language="en",
                                word_count=word_count,
                            )
                    return None

                full_text = "\n".join(transcript_lines)
                word_count = len(full_text.split())

                return TranscriptResult(
                    full_text=full_text,
                    segments=[],
                    language="en",
                    word_count=word_count,
                )

        except Exception as e:
            logger.warning(f"Jina Reader extraction failed: {e}")
            return None


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
        return {
            "title": data.get("title", "Unknown"),
            "channel": data.get("uploader", data.get("channel", "Unknown")),
            "description": (data.get("description") or "")[:5000],
            "duration_seconds": data.get("duration", 0),
            "view_count": data.get("view_count", 0),
            "like_count": data.get("like_count", 0),
            "thumbnail_url": data.get("thumbnail", ""),
            "published_at": data.get("upload_date", ""),
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
