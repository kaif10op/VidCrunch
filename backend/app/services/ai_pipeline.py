"""
AI content generation pipeline.

Handles:
  1. Transcript chunking (~500 tokens with overlap)
  2. Embedding generation
  3. Structured AI synthesis (overview, quiz, roadmap, etc.)
"""

import json
import logging
import re
import asyncio
from typing import AsyncGenerator, Optional
from functools import lru_cache

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

# Compiled regex patterns for performance
_TIMESTAMP_PATTERN = re.compile(r"\[(\d+):(\d+)\]")
_JSON_CODE_BLOCK_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]*?)```")


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
    for line in lines:
        match = _TIMESTAMP_PATTERN.match(line)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
    return None


def _extract_last_timestamp(lines: list[str]) -> Optional[float]:
    for line in reversed(lines):
        match = _TIMESTAMP_PATTERN.match(line)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
    return None


# ──────────────────────────────────────────────
# EMBEDDINGS
# ──────────────────────────────────────────────

async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a batch of texts.
    
    OPTIMIZATION: Skip embedding generation during initial processing.
    Embeddings are only needed for semantic search (RAG), which is a secondary feature.
    This dramatically speeds up the initial video processing.
    
    When embeddings are actually needed (e.g., for search), they can be generated lazily.
    """
    # Return zero vectors immediately - embeddings can be generated later on-demand
    # This saves 5-30 seconds of API calls during initial processing
    logger.info(f"Skipping embedding generation for {len(texts)} chunks (will be generated on-demand for search)")
    return [[0.0] * settings.EMBEDDING_DIMENSION for _ in texts]


async def generate_embeddings_async(texts: list[str]) -> list[list[float]]:
    """
    Actually generate embeddings when needed (e.g., for semantic search).
    Call this lazily when search is requested.
    """
    if not texts:
        return []
        
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
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
            )

            if resp.status_code == 200:
                data = resp.json()
                return [item["embedding"] for item in data["data"]]

    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")

    # Fallback: return zero vectors
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
  }},
  "glossary": [
    {{
      "term": "Key term or concept",
      "definition": "Clear, concise definition"
    }}
  ],
  "resources": [
    {{
      "name": "Resource name (e.g., book, tool, or website)",
      "url": "https://example.com/relevant-link",
      "description": "Why this resource is valuable for this topic"
    }}
  ]
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


# Fast initial analysis - high-throughput prompt
FAST_INITIAL_PROMPT = """You are an expert video analyst. Analyze this transcript quickly and precisely.
Respond in {language}. Target audience: {expertise}.

**CRITICAL: Chapter Generation**
You MUST identify and generate 5-12 logical, descriptive chapter markers for this video based on topic shifts in the transcript. 
Each label must be high-quality (min 5 words) and clearly describe the insight of that section. 
The first chapter must be at 0:00.

Return ONLY valid JSON with this structure:
{{
  "overview": "2 dense paragraphs of professional insights",
  "key_points": ["8-12 high-impact points"],
  "takeaways": ["4-6 actionable takeaways"],
  "timestamps": [
    {{"time": "0:00", "label": "Mandatory Introduction and core premise (5+ words)"}},
    {{"time": "M:SS", "label": "Descriptive topic shift label (5+ words)"}}
  ],
  "tags": ["relevant", "tags"]
}}"""


MAP_SUMMARIZE_PROMPT = """You are an expert video analyst. Summarize the following segment of a transcript.
Focus on:
1. Key technical or conceptual insights.
2. Important names, dates, or specific facts.
3. The overall "vibe" and purpose of this segment.

Keep your summary dense and factual (max 500 words). This will be combined with other segments later.
Respond in {language}."""


async def _summarize_segment(
    text: str,
    language: str,
    provider: str,
    model: str,
    semaphore: asyncio.Semaphore,
) -> str:
    """Summarize a single segment of a long transcript with concurrency limiting."""
    messages = [
        {"role": "system", "content": MAP_SUMMARIZE_PROMPT.format(language=language)},
        {"role": "user", "content": f"Transcript Segment:\n{text}"},
    ]
    async with semaphore:
        try:
            return await _call_ai_with_fallback(provider, model, messages, require_json=False)
        except Exception as e:
            logger.error(f"Segment summarization failed: {e}")
            return f"[Partial summary failed for segment of {len(text.split())} words]"


async def _summarize_chunks_parallel(
    transcript_text: str,
    language: str,
    provider: str,
    model: str,
    chunk_size_tokens: int = 10000,
) -> str:
    """Divide a long transcript and summarize segments in parallel (Pyramid approach for scale)."""
    words = transcript_text.split()
    segment_size_words = int(chunk_size_tokens / 0.75)
    
    segments = [" ".join(words[i : i + segment_size_words]) for i in range(0, len(words), segment_size_words)]
    logger.info(f"Dividing long transcript into {len(segments)} segments (Ultra-Scale Map)")
    
    # Concurrency limiter to prevent 429s
    semaphore = asyncio.Semaphore(10)
    
    tasks = [_summarize_segment(seg, language, provider, model, semaphore) for seg in segments]
    summaries = await asyncio.gather(*tasks)
    
    # Recursive reduction if too many summaries for a single prompt
    if len(summaries) > 15:
        logger.info(f"Level 2 'Pyramid' Reduction triggered for {len(summaries)} summaries")
        # Cluster summaries into meta-chunks (e.g., 5 summaries per meta-chunk)
        meta_chunks = ["\n\n".join(summaries[i : i + 5]) for i in range(0, len(summaries), 5)]
        meta_tasks = [_summarize_segment(mc, language, provider, model, semaphore) for mc in meta_chunks]
        summaries = await asyncio.gather(*meta_tasks)
        
    combined_summary = "\n\n--- SCALE-OPTIMIZED SEGMENT SUMMARIES ---\n\n".join(summaries)
    return combined_summary


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
    """
    Generate structured learning content from a transcript using AI.
    
    OPTIMIZATION: Initial analysis generates only essential content (overview, key_points, timestamps).
    Heavy tools (quiz, flashcards, mind_map, roadmap, podcast) are generated on-demand via generate_tool endpoint.
    This reduces initial processing time from 30-60s to 5-15s.
    """
    provider = provider or settings.DEFAULT_AI_PROVIDER
    model = model or settings.DEFAULT_AI_MODEL

    # If specific tools are requested, use targeted generation
    if tools:
        return await _generate_specific_tools(
            transcript_text, metadata, tools, expertise, style, language, 
            provider, model, existing_data
        )

    # For initial analysis, use the fast prompt (overview + key_points + timestamps + tags)
    if minimal_mode:
        system_prompt = MINIMAL_SYSTEM_PROMPT_TEMPLATE.format(language=language)
    else:
        system_prompt = FAST_INITIAL_PROMPT.format(
            language=language,
            expertise=expertise,
        )
        
        if is_multi_video:
            system_prompt += "\n\nNote: You are analyzing MULTIPLE videos. Synthesize them into one unified analysis."

    # Resilience Mode: Check if this is a metadata-only fallback
    is_metadata_only = "ANALYSIS SOURCE: VIDEO METADATA" in transcript_text
    if is_metadata_only:
        system_prompt += "\n\nIMPORTANT: Full transcription was unavailable for this video. You are performing a 'Full-Spectrum Resilience Analysis' based ONLY on the video Title and Description. Still provide a full, structured analysis (Overview, Key Points, Quiz, Flashcards, etc.). \n\n**CRITICAL**: You must reconstruct a detailed 'Narrative Summary Transcript' as the first part of your response. Use the provided roadmap context to imagine how the content would flow and be as detailed as possible. DO NOT mention that the transcript is missing—just be an insightful AI analyst."

    # Map-Reduce logic for long transcripts
    total_tokens = count_tokens(transcript_text)
    max_single_prompt_tokens = 10000
    
    if total_tokens > max_single_prompt_tokens + 2000: # 2k buffer
        logger.info(f"Transcript too long ({total_tokens} tokens). Using Map-Reduce approach.")
        # Step 1: Map (Parallel Summarization)
        summary_of_transcript = await _summarize_chunks_parallel(
            transcript_text, language, provider, model, chunk_size_tokens=max_single_prompt_tokens
        )
        context_text = f"The following is a synthesised summary of a long video transcript. Use this to generate the final structured analysis.\n\nSummary:\n{summary_of_transcript}"
    else:
        # Standard approach for shorter videos
        context_text = f"Transcript:\n{transcript_text}"

    title = metadata.get("title", "Unknown")
    channel = metadata.get("channel", "Unknown")
    user_content = f'Video: "{title}" by {channel}\n\n{context_text}'

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
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Try extracting from code block
    code_match = _JSON_CODE_BLOCK_PATTERN.search(content)
    if code_match:
        try:
            return json.loads(code_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    raise AIError("Failed to parse AI response as JSON")


async def _generate_specific_tools(
    transcript_text: str,
    metadata: dict,
    tools: list[str],
    expertise: str,
    style: str,
    language: str,
    provider: str,
    model: str,
    existing_data: Optional[str] = None,
) -> dict:
    """Generate specific tools on-demand."""
    
    # Tool-specific prompts for better quality
    tool_prompts = {
        "quiz": """Generate a quiz with 5-8 multiple choice questions testing understanding of this content.
Return JSON: {{"quiz": [{{"question": "...", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "..."}}]}}""",
        
        "flashcards": """Create 8-12 flashcards for studying this content.
Return JSON: {{"flashcards": [{{"front": "Question or concept", "back": "Answer or explanation", "hint": "Memory aid"}}]}}""",
        
        "roadmap": """Create a learning roadmap with 5-8 steps to master this topic.
Return JSON: {{"roadmap": {{"title": "...", "steps": [{{"step": 1, "task": "...", "description": "..."}}]}}}}""",
        
        "mind_map": """Create a mind map with 8-12 nodes showing concept relationships.
Return JSON: {{"mind_map": {{"nodes": [{{"id": "1", "label": "..."}}], "edges": [{{"source": "1", "target": "2", "label": "..."}}]}}}}""",
        
        "glossary": """Extract 10-15 key terms and their definitions.
Return JSON: {{"glossary": [{{"term": "...", "definition": "..."}}]}}""",
        
        "resources": """Suggest 5-8 relevant learning resources.
Return JSON: {{"resources": [{{"name": "...", "url": "...", "description": "..."}}]}}""",
        
        "learning_context": """Explain the learning context for this topic.
Return JSON: {{"learning_context": {{"why": "Why this matters", "whatToHowTo": "How to learn this", "bestWay": "Best approach"}}}}""",
        
        "podcast": """Create an engaging podcast script discussing this content.
Return JSON: {{"podcast": {{"script": "Host A: ... Host B: ...", "audioUrl": ""}}}}""",
    }
    
    # Build tool-specific prompt
    tool_instructions = []
    for tool in tools:
        if tool in tool_prompts:
            tool_instructions.append(tool_prompts[tool])
    
    if not tool_instructions:
        # Default for unknown tools
        tool_instructions.append(f"Generate content for: {', '.join(tools)}")
    
    system_prompt = f"""You are an expert educational content creator.
Target audience: {expertise}. Language: {language}. Style: {style}.

{chr(10).join(tool_instructions)}

Return ONLY valid JSON containing the requested keys."""

    if existing_data:
        system_prompt += f"\n\nExisting content (generate NEW, different items):\n{existing_data}"

    max_transcript_tokens = 10000
    truncated = _truncate_to_tokens(transcript_text, max_transcript_tokens)
    
    title = metadata.get("title", "Unknown")
    user_content = f'Video: "{title}"\n\nTranscript:\n{truncated}'

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    content = await _call_ai_with_fallback(provider, model, messages, require_json=True)
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        code_match = _JSON_CODE_BLOCK_PATTERN.search(content)
        if code_match:
            return json.loads(code_match.group(1).strip())
        raise AIError("Failed to parse tool generation response")


class AITransientError(Exception):
    pass


class AIError(Exception):
    pass


async def _call_ai(provider: str, model: str, messages: list[dict], require_json: bool = True) -> str:
    """Call an AI provider's chat completion API with manual retries.

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

    # Guard missing API key
    if not api_key:
        raise AIError(f"{provider.upper()} API key not configured")

    # For OpenRouter, use the AI_MODEL env var if available AND no model was passed
    if provider == "openrouter" and not model and settings.AI_MODEL:
        model = settings.AI_MODEL

    # Ensure we have a model name
    model = model or settings.DEFAULT_AI_MODEL

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://vidcrunch.app"
            headers["X-Title"] = "VidCrunch"

        body = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 8000,
        }
        if require_json:
            body["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(url, headers=headers, json=body, timeout=120.0)
            except httpx.TimeoutException as e:
                logger.error(f"AI request timed out: {e}")
                if attempt == max_attempts:
                    raise AITransientError("AI request timed out") from e
                else:
                    await asyncio.sleep(min(2 ** attempt, 10))
                    continue
            except httpx.ConnectError as e:
                logger.error(f"AI connection error: {e}")
                if attempt == max_attempts:
                    raise AITransientError("AI connection failed") from e
                else:
                    await asyncio.sleep(min(2 ** attempt, 10))
                    continue

        if resp.status_code != 200:
            error_detail = resp.text[:500]
            logger.error(f"AI error [{resp.status_code}]: {error_detail}")
            raise AIError(f"AI provider error: {resp.status_code}")

        data = resp.json()
        return data["choices"][0]["message"]["content"]

    raise AIError(f"Failed to get response from {provider} after {max_attempts} attempts")


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