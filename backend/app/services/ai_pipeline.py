"""
AI content generation pipeline.

Handles:
  1. Transcript chunking (~500 tokens with overlap)
  2. Embedding generation
  3. Structured AI synthesis (overview, quiz, roadmap, etc.)
"""

import json
import logging
from typing import AsyncGenerator, Optional

import httpx
import tiktoken

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Token counter
try:
    _encoder = tiktoken.get_encoding("cl100k_base")
except Exception:
    _encoder = None


def count_tokens(text: str) -> int:
    if _encoder:
        return len(_encoder.encode(text))
    return len(text.split())  # fallback word count approx


# ──────────────────────────────────────────────
# CHUNKING
# ──────────────────────────────────────────────

def chunk_transcript(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[dict]:
    """
    Split transcript into overlapping chunks of ~chunk_size tokens.
    Returns list of {text, start_time, end_time, token_count, chunk_index}.
    """
    lines = text.strip().split("\n")
    chunks = []
    current_chunk_lines = []
    current_tokens = 0
    chunk_index = 0

    import re

    for line in lines:
        line_tokens = count_tokens(line)

        if current_tokens + line_tokens > chunk_size and current_chunk_lines:
            # Emit chunk
            chunk_text = "\n".join(current_chunk_lines)
            start_time = _extract_first_timestamp(current_chunk_lines)
            end_time = _extract_last_timestamp(current_chunk_lines)

            chunks.append({
                "text": chunk_text,
                "start_time": start_time,
                "end_time": end_time,
                "token_count": current_tokens,
                "chunk_index": chunk_index,
            })
            chunk_index += 1

            # Keep overlap
            overlap_lines = []
            overlap_tokens = 0
            for prev_line in reversed(current_chunk_lines):
                lt = count_tokens(prev_line)
                if overlap_tokens + lt > overlap:
                    break
                overlap_lines.insert(0, prev_line)
                overlap_tokens += lt

            current_chunk_lines = overlap_lines
            current_tokens = overlap_tokens

        current_chunk_lines.append(line)
        current_tokens += line_tokens

    # Final chunk
    if current_chunk_lines:
        chunk_text = "\n".join(current_chunk_lines)
        chunks.append({
            "text": chunk_text,
            "start_time": _extract_first_timestamp(current_chunk_lines),
            "end_time": _extract_last_timestamp(current_chunk_lines),
            "token_count": current_tokens,
            "chunk_index": chunk_index,
        })

    return chunks


def _extract_first_timestamp(lines: list[str]) -> Optional[float]:
    import re
    for line in lines:
        match = re.match(r"\[(\d+):(\d+)\]", line)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
    return None


def _extract_last_timestamp(lines: list[str]) -> Optional[float]:
    import re
    for line in reversed(lines):
        match = re.match(r"\[(\d+):(\d+)\]", line)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
    return None


# ──────────────────────────────────────────────
# EMBEDDINGS
# ──────────────────────────────────────────────

async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts using the configured provider."""
    # Use Groq's OpenAI-compatible endpoint
    # Note: If Groq doesn't support embeddings, we fall back to a zero vector
    try:
        async with httpx.AsyncClient() as client:
            # Try OpenAI-compatible embedding endpoint
            resp = await client.post(
                "https://api.groq.com/openai/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.EMBEDDING_MODEL,
                    "input": [t[:8000] for t in texts],
                },
                timeout=60.0,
            )

            if resp.status_code == 200:
                data = resp.json()
                return [item["embedding"] for item in data["data"]]

    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")

    # Fallback: return zero vectors (RAG search won't work, but analysis continues)
    logger.warning("Using zero-vector embeddings as fallback")
    return [[0.0] * settings.EMBEDDING_DIMENSION for _ in texts]


# ──────────────────────────────────────────────
# AI SYNTHESIS
# ──────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are an expert educational AI assistant and YouTube video analyst.
{multi_video_instruction}
The target audience expertise level is: {expertise}. Adjust depth and terminology accordingly.
Respond in {language}. Style: {style}.

Return ONLY valid JSON (no markdown, no code blocks) with this EXACT structure:
{{
  "overview": "3-5 paragraphs of detailed analysis",
  "key_points": ["10-15 detailed insight strings"],
  "takeaways": ["6-10 actionable takeaway strings"],
  "timestamps": [
    {{
      "time": "0:00", 
      "label": "Detailed, descriptive label (min 5 words) focusing on the key insight of this section"
    }}
  ],
  "roadmap": {{
    "title": "Mastery Roadmap",
    "steps": [{{"step": 1, "task": "Task name", "description": "Detailed description"}}]
  }},
  "learning_context": {{
    "why": "Why this topic matters",
    "whatToHowTo": "Step-by-step learning guidance",
    "bestWay": "Most effective approach"
  }},
  "quiz": [
    {{
      "question": "Clear question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why this answer is correct"
    }}
  ],
  "mind_map": {{
    "nodes": [{{"id": "1", "label": "Central Topic"}}, {{"id": "2", "label": "Sub-concept"}}],
    "edges": [{{"source": "1", "target": "2", "label": "relates to"}}]
  }},
  "tags": ["tag1", "tag2"],
  "flashcards": [
    {{
      "front": "Key concept or question",
      "back": "Detailed explanation or answer",
      "hint": "A subtle, non-giving-away hint to nudge the user's memory"
    }}
  ],
  "podcast": {{
    "script": "A high-fidelity dialogue script between two hosts (e.g., Alex and Taylor) discussing the video insights. Make it engaging and professional.",
    "audioUrl": ""
  }}
}}

Rules:
- Respond in {language}
- Generate very detailed, accurate content
- Create at least 5 quiz questions
- Create at least 8 flashcards
- Mind map should have at least 8 nodes"""


MINIMAL_SYSTEM_PROMPT_TEMPLATE = """You are a video analysis expert. 
Create logical, descriptive chapter markers for the following transcript.
Respond in {language}.

Return ONLY valid JSON with this EXACT structure:
{{
  "timestamps": [
    {{
      "time": "0:00", 
      "label": "Descriptive and high-quality label (min 5 words) covering the main topic of this segment"
    }}
  ]
}}"""


async def synthesize_content(
    transcript_text: str,
    metadata: dict,
    expertise: str = "intermediate",
    style: str = "detailed",
    language: str = "English",
    is_multi_video: bool = False,
    provider: str = None,
    model: str = None,
    minimal_mode: bool = False,
    tools: Optional[list[str]] = None,
    existing_data: Optional[str] = None,
) -> dict:
    """Generate structured learning content from a transcript using AI."""
    provider = provider or settings.DEFAULT_AI_PROVIDER
    model = model or settings.DEFAULT_AI_MODEL

    multi_instruction = ""
    if is_multi_video:
        multi_instruction = (
            "You are analyzing MULTIPLE videos. Synthesize them into one unified guide, "
            "comparing and combining their insights."
        )

    if minimal_mode:
        system_prompt = MINIMAL_SYSTEM_PROMPT_TEMPLATE.format(
            language=language
        )
        if language.lower() == "english":
            system_prompt += "\nIf the transcript is not in English, translate the summary and chapters into English."
    else:
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            multi_video_instruction=multi_instruction,
            expertise=expertise,
            language=language,
            style=style,
        )

    # Core tools that are always generated in initial analysis
    CORE_TOOLS = ["timestamps"]
    
    # If no specific tools are requested and not in minimal mode, default to core tools
    if not tools and not minimal_mode:
        tools = CORE_TOOLS

    if tools:
        # Override for targeted generation
        tool_instruction = f"\n\nCRITICAL: Generate ONLY the following JSON keys: {', '.join(tools)}. Skip all other keys."
        system_prompt += tool_instruction

    if existing_data:
        context_instruction = f"\n\nEXISTING CONTENT DISCOVERY:\nThe following items already exist for these tools. Generate NEW, UNIQUE, and COMPLEMENTARY items that do not repeat the following:\n{existing_data}"
        system_prompt += context_instruction

    # Truncate transcript to fit context window
    max_transcript_tokens = 12000
    truncated = _truncate_to_tokens(transcript_text, max_transcript_tokens)

    title = metadata.get("title", "Unknown")
    channel = metadata.get("channel", "Unknown")
    user_content = f'Video: "{title}" by {channel}\n\nTranscript:\n{truncated}'

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    content = await _call_ai_with_fallback(
        provider, model, messages, require_json=True
    )

    if not content:
        raise AIError("AI provider returned empty response")

    # Parse JSON (handle markdown code blocks)
    try:
        json_match = json.loads(content)
        return json_match
    except json.JSONDecodeError:
        pass

    # Try extracting from code block
    import re
    code_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if code_match:
        try:
            return json.loads(code_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    raise AIError("Failed to parse AI response as JSON")


async def _call_ai(provider: str, model: str, messages: list[dict], require_json: bool = True) -> str:
    """Call an AI provider's chat completion API.

    Supported providers:
      - groq: Groq Cloud (OpenAI-compatible)
      - openrouter: OpenRouter (uses AI_MODEL env var)
      - xai: xAI Grok
      - cerebras: Cerebras
      - google: Google AI (Gemini — different API format)
    """
    # Google AI (Gemini) uses a completely different API format
    if provider == "google":
        return await _call_google_ai(model, messages)

    url_map = {
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "xai": "https://api.x.ai/v1/chat/completions",
        "cerebras": "https://api.cerebras.ai/v1/chat/completions",
    }

    key_map = {
        "groq": settings.GROQ_API_KEY,
        "openrouter": settings.OPENROUTER_API_KEY,
        "xai": settings.XAI_API_KEY,
        "cerebras": settings.CEREBRAS_API_KEY,
    }

    url = url_map.get(provider, url_map["groq"])
    api_key = key_map.get(provider, settings.GROQ_API_KEY)

    # For OpenRouter, use the AI_MODEL env var if available AND no model was passed
    if provider == "openrouter" and not model and settings.AI_MODEL:
        model = settings.AI_MODEL
    
    # Ensure we have a model name
    model = model or settings.DEFAULT_AI_MODEL

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://youtube-genius.app"
        headers["X-Title"] = "YouTube Genius"

    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 8000,
    }
    
    if require_json:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=body, timeout=120.0)

        if resp.status_code != 200:
            error_detail = resp.text[:500]
            logger.error(f"AI error [{resp.status_code}]: {error_detail}")
            raise AIError(f"AI provider error: {resp.status_code}")

        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _call_google_ai(model: str, messages: list[dict]) -> str:
    """Call Google AI (Gemini) with its native API format."""
    api_key = settings.GOOGLE_AI_KEY
    if not api_key:
        raise AIError("GOOGLE_AI_KEY not configured")

    # Default to gemini-2.0-flash
    gemini_model = model if model.startswith("gemini") else "gemini-2.0-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"

    # Convert OpenAI-style messages to Gemini format
    contents = []
    system_instruction = None

    for msg in messages:
        if msg["role"] == "system":
            system_instruction = msg["content"]
        elif msg["role"] == "user":
            contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
        elif msg["role"] == "assistant":
            contents.append({"role": "model", "parts": [{"text": msg["content"]}]})

    body = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
        },
    }

    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, timeout=120.0)

        if resp.status_code != 200:
            error_detail = resp.text[:500]
            logger.error(f"Google AI error [{resp.status_code}]: {error_detail}")
            raise AIError(f"Google AI error: {resp.status_code}")

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise AIError("Google AI returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise AIError("Google AI returned empty content")

        return parts[0].get("text", "")


async def _call_ai_with_fallback(
    provider: str, model: str, messages: list[dict], require_json: bool = True
) -> str:
    """Try multiple AI providers in sequence if errors occur."""
    fallback_chain = _get_fallback_chain(provider, model)
    last_error = None

    for p, m in fallback_chain:
        try:
            return await _call_ai(p, m, messages, require_json=require_json)
        except Exception as e:
            logger.warning(f"AI provider {p} fallback triggered: {e}")
            last_error = e
            continue

    raise AIError(f"All AI providers failed. Last error: {last_error}")


async def _stream_ai_with_fallback(
    provider: str, model: str, messages: list[dict]
) -> AsyncGenerator[str, None]:
    """Try multiple AI providers in sequence for streaming."""
    fallback_chain = _get_fallback_chain(provider, model)
    
    for p, m in fallback_chain:
        try:
            async for chunk in _stream_ai(p, m, messages):
                yield chunk
            return  # Success
        except Exception as e:
            logger.warning(f"AI streaming fallback for {p} triggered: {e}")
            continue

    yield "Error: All AI providers failed. Please try again later."


def _get_fallback_chain(provider: str, model: str) -> list[tuple[str, str]]:
    """Determine the order of AI providers to try."""
    chain = []
    
    # 1. Primary
    chain.append((provider or settings.DEFAULT_AI_PROVIDER, model or settings.DEFAULT_AI_MODEL))
    
    # 2. Secondary options based on what's configured
    options = [
        ("groq", "llama-3.3-70b-versatile"),
        ("cerebras", "llama3.1-70b"),
        ("google", "gemini-2.0-flash"),
        ("xai", "grok-2-latest"),
        ("openrouter", "google/gemini-2.0-flash-001"),
    ]
    
    for opt_p, opt_m in options:
        # Don't add if already in chain
        if not any(p == opt_p for p, m in chain):
            # Check if API key exists
            key_exists = False
            if opt_p == "groq" and settings.GROQ_API_KEY: key_exists = True
            if opt_p == "cerebras" and settings.CEREBRAS_API_KEY: key_exists = True
            if opt_p == "google" and settings.GOOGLE_AI_KEY: key_exists = True
            if opt_p == "xai" and settings.XAI_API_KEY: key_exists = True
            if opt_p == "openrouter" and settings.OPENROUTER_API_KEY: key_exists = True
            
            if key_exists:
                chain.append((opt_p, opt_m))
                
    return chain


async def _stream_ai(provider: str, model: str, messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream response from an AI provider."""
    if provider == "google":
        # Google streaming is slightly different, but for now we fallback to non-stream or handle it
        # Simplified: yield the whole response if streaming not easily piped
        res = await _call_google_ai(model, messages)
        yield res
        return

    url_map = {
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "xai": "https://api.x.ai/v1/chat/completions",
        "cerebras": "https://api.cerebras.ai/v1/chat/completions",
    }
    
    url = url_map.get(provider, url_map["groq"])
    api_key = getattr(settings, f"{provider.upper()}_API_KEY", settings.GROQ_API_KEY)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    body = {
        "model": model or settings.DEFAULT_AI_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "stream": True,
    }

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, headers=headers, json=body, timeout=60.0) as resp:
            if resp.status_code != 200:
                error = await resp.aread()
                raise AIError(f"Streaming error {resp.status_code}: {error.decode()}")

            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                
                line_data = line[6:].strip()
                if line_data == "[DONE]":
                    break
                
                try:
                    chunk = json.loads(line_data)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield delta
                except Exception:
                    continue


def _truncate_to_tokens(text: str, max_tokens: int) -> str:
    """Truncate text to approximately max_tokens."""
    if _encoder:
        tokens = _encoder.encode(text)
        if len(tokens) <= max_tokens:
            return text
        return _encoder.decode(tokens[:max_tokens])
    else:
        words = text.split()
        if len(words) <= max_tokens:
            return text
        return " ".join(words[:max_tokens])


class AIError(Exception):
    pass

