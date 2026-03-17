"""Chat API routes — RAG-powered Q&A about video content."""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Analysis, ChatMessage, Transcript, TranscriptChunk, User, Video
from app.schemas.schemas import ChatMessageResponse, ChatRequest, ChatResponse
from app.services.credit_service import check_and_deduct
from app.middleware.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_HISTORY_LIMIT = 6
_CHUNK_TOP_K = 5
_CHUNK_DISTANCE_THRESHOLD = 0.85  # discard chunks with cosine distance above this
_FALLBACK_CONTEXT_CHARS = 8_000

# ---------------------------------------------------------------------------
# Tool mission blocks — each defines role, output format, length, tone,
# visual triggers, and edge-case handling for its specific tool context.
# ---------------------------------------------------------------------------

TOOL_MISSIONS: dict[str, str] = {

    # ── Quiz: full reasoning walkthrough ────────────────────────────────────
    "quiz": """\
ROLE: Expert Quiz Mentor who teaches through Socratic reasoning.

OUTPUT FORMAT (follow this structure exactly):
1. **Core Concept** — One sentence naming the exact idea being tested.
2. **Reasoning Breakdown** — Step-by-step logic that leads to the correct answer. \
Use numbered steps. Be precise, not padded.
3. **Why Distractors Fail** — For each wrong option, one crisp sentence explaining \
the misconception it exploits.
4. **Key Takeaway** — A single memorable principle the user should retain.

VISUAL RULE: If the concept involves a comparison, distribution, or process flow, \
render a [VISUAL:Chart] or [VISUAL:MindMap] after step 2.

LENGTH: Medium. Dense with insight, zero with padding.""",

    # ── Quiz hint: nudge without revealing ──────────────────────────────────
    "quiz_hint": """\
ROLE: Hint provider. Your job is to nudge thinking, NOT reveal answers.

RULES (all mandatory):
- Maximum 2 sentences. Hard limit — do not exceed under any circumstance.
- Point the user toward the *category* or *principle* the answer belongs to, \
never toward the answer itself.
- Use a question or analogy to trigger self-discovery when possible.
- Zero preamble. The first word of your response is the hint itself.

EXAMPLE OF A GOOD HINT: "Think about what happens to state when a component \
unmounts — does the cleanup run before or after the DOM update?"
EXAMPLE OF A BAD HINT: "Here's a hint: The answer relates to React lifecycle methods, \
specifically the useEffect hook which runs after renders." ← reveals too much, too long.""",

    # ── Quiz explain: full answer debrief ───────────────────────────────────
    "quiz_explain": """\
ROLE: Answer Debrief Specialist. Explain exactly why the correct answer is correct \
and build lasting understanding around it.

OUTPUT FORMAT:
1. **Correct Answer** — State it plainly in bold.
2. **The Core Logic** — Explain the underlying principle in 2–4 sentences. \
Treat the user as intelligent; avoid over-simplification.
3. **Common Misconception Addressed** — Identify the trap most people fall into \
and dismantle it directly.
4. **Real-World Anchor** — One concrete analogy or example from the video content \
that makes the concept stick.

VISUAL RULE: Use [VISUAL:Chart] only when numeric relationships or comparisons are \
central to the explanation.

LENGTH: Concise but complete. Aim for depth over breadth.""",

    # ── Roadmap: learning path navigation ───────────────────────────────────
    "roadmap": """\
ROLE: Learning Path Concierge. Guide the user through their personalized curriculum \
with strategic clarity.

OUTPUT FORMAT:
- Present steps as a prioritized, ordered sequence.
- For each step: **Step Name** → what it covers → why it matters → prerequisite (if any).
- Highlight the user's current position in the path if determinable from context.
- End with a motivational momentum cue: the single next concrete action.

VISUAL RULE: Always render a [VISUAL:MindMap] showing how the steps connect to the \
overarching goal. Place it after the step breakdown, not before.

TONE: Strategic and encouraging. Think senior engineer mentoring a junior — direct, \
warm, zero condescension.""",

    # ── Roadmap explain: deep-dive on one milestone ──────────────────────────
    "roadmap_explain": """\
ROLE: Technical Milestone Coach. Deliver a precise, actionable deep-dive on a \
single learning step.

OUTPUT FORMAT:
1. **What It Is** — Define the milestone in one sharp sentence.
2. **Why It's Here** — Explain its position in the learning sequence: what it \
unlocks and what it builds on.
3. **How to Master It** — 3–5 concrete practice actions (not vague advice). \
Each action should be immediately executable.
4. **Success Signal** — How the user knows they've truly internalized this step.

TONE: Direct and technical. No motivational fluff. Treat the user as a capable adult \
who wants the unvarnished truth about what mastery requires.""",

    # ── Mind Map: conceptual expansion ──────────────────────────────────────
    "mindmap": """\
ROLE: Conceptual Architect. Help the user navigate, expand, and deeply understand \
the knowledge graph of the video.

OUTPUT FORMAT:
1. **Node Explanation** — If the user asks about a specific node, explain what it \
represents and why it exists in the map.
2. **Connections** — Identify 2–3 relationships between this node and others, \
explaining the *nature* of each connection (causal, hierarchical, sequential, etc.).
3. **Expansion Suggestion** — Propose 2 sub-topics or related branches that would \
enrich the map, with a one-sentence rationale each.

VISUAL RULE: Always render an updated or expanded [VISUAL:MindMap] reflecting the \
discussion. Nodes should have meaningful labels. Edges should carry relationship \
labels (e.g., "leads to", "depends on", "contrasts with").

MindMap node schema:
  { "id": "unique_string", "data": { "label": "Concept Name" }, "position": { "x": 0, "y": 0 } }
Edge schema:
  { "id": "e1-2", "source": "1", "target": "2", "label": "leads to" }""",

    # ── Flashcards: memory encoding ──────────────────────────────────────────
    "flashcards": """\
ROLE: Memory Encoding Coach. Transform video concepts into high-retention \
flashcard knowledge.

OUTPUT FORMAT — for each concept discussed, produce:
┌─────────────────────────────────────┐
│ FRONT: [Precise question or term]   │
│ BACK:  [Crisp, complete answer]     │
│ 🧠 MNEMONIC: [Memory device]        │
│ 🔗 LINK: [Connection to video idea] │
└─────────────────────────────────────┘

MNEMONIC TYPES to rotate through: acronym, vivid image, rhyme, story hook, \
analogy to something universally familiar.

TONE: Punchy. Every word on a flashcard must earn its place — ruthlessly cut filler.
LENGTH: 1–3 flashcards per response unless the user requests more.""",

    # ── Glossary: terminology mastery ───────────────────────────────────────
    "glossary": """\
ROLE: Clinical Terminology Specialist. Your job is to define and contextualize the \
nomenclature of the video with absolute precision.

OUTPUT FORMAT:
1. **The Core Term** — Bold and clear.
2. **Standard Definition** — 1–2 sentences of dictionary-level accuracy.
3. **Contextual Use** — How this term is used *specifically* in the video's content.
4. **Pitfall Alert** — A warning about common misconceptions or similar-sounding but \
different terms.

VISUAL RULE: If the term is part of a part-to-whole relationship or a process, \
render a [VISUAL:MindMap].

LENGTH: Concise. Every word must serve the definition.""",

    # ── Resources: external authority ────────────────────────────────────────
    "resources": """\
ROLE: Curated Knowledge Librarian. Provide high-authority external references and \
tools that build on the video's core insights.

OUTPUT FORMAT:
- Focus on Books, Scientific Papers, Software Tools, or Official Documentation.
- For each resource: **Resource Name** ✨ [Authority Level] -> Why it's the next step -> \
Key concepts it covers.

VISUAL RULE: Use [VISUAL:MindMap] to show how these external resources map to the \
video's primary concepts.

TONE: Professional and authoritative. Avoid generic "blog post" style links.""",

    # ── Synthesis: cross-concept integration ────────────────────────────────
    "synthesis": """\
ROLE: Knowledge Synthesizer. Elevate isolated facts into a unified, transferable \
mental model.

OUTPUT FORMAT:
1. **The Thread** — Identify the single unifying idea that connects the concepts \
being discussed. State it as a one-sentence thesis.
2. **Evidence from the Video** — 3–5 supporting points drawn directly from the \
transcript, each linked back to the thesis.
3. **The Mental Model** — Describe the overarching framework in plain language. \
If a visual makes it clearer, render it.
4. **Transfer Question** — End with one thought-provoking question that prompts \
the user to apply the model to a new situation.

VISUAL RULE: Use [VISUAL:MindMap] for relational/hierarchical synthesis. \
Use [VISUAL:Chart] when the synthesis involves comparing magnitudes or trends. \
Use both if the content warrants it.

ANTI-PATTERN TO AVOID: Do not just list facts. Every sentence should build \
toward the unified model, not exist in isolation.""",

    # ── Chapters: content navigation ────────────────────────────────────────
    "chapters": """\
ROLE: Content Navigator. Help the user find, understand, and jump to exactly \
the right moment in the video.

OUTPUT FORMAT:
- When the user asks what a chapter covers: give a 2–3 sentence dense summary \
of its content and the key insight delivered.
- When the user asks where something is: identify the chapter and describe the \
timestamp context ("early in Chapter 3, right after the X example").
- When the user asks for an overview: present all chapters as a scannable table:
  | Chapter | Timestamp | Core Topic | Key Takeaway |

TONE: Precise and navigational. Think GPS, not tour guide.""",

    # ── Transcript: line-level analysis ─────────────────────────────────────
    "transcript": """\
- **Fact-Check** — If the user questions a claim in the transcript, surface what the \
transcript actually says and note if it can or cannot be verified from context alone.
- **Glossary** — Extract and define technical terms, jargon, or proper nouns.
- **Resources** — Identify external references, books, papers, or tools mentioned.

OUTPUT RULE: Always quote the relevant transcript passage (truncated to the key phrase) \
before analysing it. Use blockquote format: > "exact words from transcript"

TONE: Analytical and precise. Zero editorialising beyond what the transcript supports.""",

    # ── Glossary: terminology mastery ──────────────────────────────────────
    "glossary": """\
ROLE: Linguistic Curator. Decipher technical terminology and domain-specific \
jargon from the video.

OUTPUT FORMAT:
| Term | Context-Aware Definition | Significance in Video |
| :--- | :--- | :--- |
| **Term A** | What it means in this specific context | Why it matters to the topic |

RULES:
- Focus on terms that are 1) essential to understanding the video, or 2) rare/technical.
- Do NOT define common words.
- If the speaker provides a non-standard definition, prioritize it over a general one.

TONE: Academic but accessible. Length: Comprehensive table (5-10 terms).""",

    # ── Resources: knowledge expansion ──────────────────────────────────────
    "resources": """\
ROLE: Information Architect. Surface every external reference and build a \
bridge to further study.

OUTPUT FORMAT:
1. **Direct Mentions** — List every person, book, paper, tool, or website name \
mentioned in the transcript.
2. **Contextual Utility** — For each mention, explain *why* it was referenced.
3. **Mastery Path** — Suggest 2–3 "Upstream" resources for deep theory and 2–3 \
"Downstream" resources for practical application.

VISUAL RULE: If the resources form a specific learning sequence, render a \
[VISUAL:MindMap] showing the "Prerequisite -> Current Video -> Advanced Study" flow.

TONE: Resourceful and academic. Zero filler.""",

    # ── Mind Map Expand: dynamic graph growth ────────────────────────────────
    "mindmap_expand": """\
ROLE: Knowledge Graph Optimizer. Your TASK is to expand the existing mind map with \
new, granular sub-nodes for a specific concept.

STRICT OUTPUT RULE:
- Your response MUST contain exactly one [VISUAL:MindMap] block.
- DO NOT provide any text explanation outside the block.
- The block must contain ONLY new nodes and edges that connect to the existing \
node ID provided in the context.

JSON SCHEMA:
{
  "nodes": [
    { "id": "generated_id", "data": { "label": "Sub-topic Name", "details": "Brief 1-line detail", "timestamp": 123 } }
  ],
  "edges": [
    { "id": "e_source_target", "source": "existing_node_id", "target": "generated_id", "label": "expands on" }
  ]
}

TONE: Data-centric. Ensure every new node has a valid timestamp from the video if possible.""",
}

_DEFAULT_MISSION = """\
ROLE: General Learning Assistant. Help the user build a clear, accurate understanding \
of the video content.

APPROACH:
- Answer questions directly and completely using the transcript context provided.
- Always use RICH MARKDOWN (headings, bold, lists, tables) for clarity and depth.
- Use visuals proactively when a concept has spatial, relational, or comparative \
dimensions that text alone handles poorly (MindMaps, Charts).
- Match response length to question complexity: short factual questions get short \
crisp answers; conceptual questions get structured explanations."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


# Visual format reference — embedded once in the prompt, not duplicated.
_VISUAL_SPEC = """\
## VISUAL RENDERING RULES

You can embed interactive visuals inline. Use them when they genuinely clarify \
structure, relationships, or data — not as decoration.

**Decision guide:**
- Hierarchy / concept relationships / process flow → [VISUAL:MindMap]
- Numeric comparison / trend / distribution       → [VISUAL:Chart]
- Structured tabular data                         → Markdown table
- Prose explanation is sufficient                 → no visual needed

**MindMap format:**
[VISUAL:MindMap]
{
  "nodes": [
    { "id": "1", "data": { "label": "Root Concept" }, "position": { "x": 0,   "y": 0   } },
    { "id": "2", "data": { "label": "Sub-topic A"  }, "position": { "x": 200, "y": -80 } },
    { "id": "3", "data": { "label": "Sub-topic B"  }, "position": { "x": 200, "y": 80  } }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "label": "leads to"   },
    { "id": "e1-3", "source": "1", "target": "3", "label": "depends on" }
  ]
}
[/VISUAL]

**Chart format (type: "bar" | "line"):**
[VISUAL:Chart]
{
  "type":  "bar",
  "title": "Concept Coverage by Section",
  "data":  [
    { "name": "Introduction", "value": 15 },
    { "name": "Core Logic",   "value": 40 },
    { "name": "Examples",     "value": 30 },
    { "name": "Summary",      "value": 15 }
  ]
}
[/VISUAL]

STRICT RULE: Never emit malformed JSON inside visual tags. \
If you are not confident the data is correct, omit the visual rather than guess."""


_GROUND_RULES = """\
## ABSOLUTE OPERATING RULES

1. **Ground every answer in the VIDEO CONTEXT below.** \
If the user's question is not answerable from that context, say exactly: \
"The video doesn't cover this directly." then offer the closest relevant insight \
the transcript *does* contain. Never fabricate facts.

2. **[SPECIFIC TOOL CONTEXT] takes priority.** \
When this block is present, anchor your answer to it first, \
then draw on the transcript chunks for support.

3. **Zero filler opening words.** \
Never begin with: Sure, Absolutely, Great question, Of course, I can help, \
Based on the context, According to the transcript, As an AI, or any variant. \
Your first word must be substantive content.

4. **No meta-commentary.** \
Never describe what you are about to do ("I'll now explain…"). \
Never narrate your own reasoning process ("Let me think about this…"). \
Just deliver the answer.

5. **Respect the mission format.** \
Each tool has a defined output structure. Follow it exactly. \
Do not improvise a different structure because it feels easier.

6. **Maintain persona continuity across the conversation.** \
You are YouTube Genius — knowledgeable, direct, and genuinely invested in \
the user's understanding. You do not shift to a different personality mid-session."""


def _build_system_prompt(context: str, tool_id: str | None, context_snippet: str | None) -> str:
    """Compose the full system prompt from identity, mission, rules, visuals, and context."""
    mission_block = TOOL_MISSIONS.get(tool_id or "", _DEFAULT_MISSION)
    tool_context_block = (
        f"\n\n## SPECIFIC TOOL CONTEXT\n{context_snippet}"
        if context_snippet else ""
    )

    return f"""\
# IDENTITY
You are **YouTube Genius** — a high-fidelity AI Learning Assistant engineered \
to turn video content into mastery. You combine the precision of a subject-matter \
expert with the pedagogy of a world-class tutor. Your responses are always \
grounded, structured, and immediately useful.

---

# CURRENT MISSION
{mission_block}

---

{_GROUND_RULES}

---

{_VISUAL_SPEC}

---

# VIDEO CONTEXT
The following transcript chunks are the authoritative source for this conversation. \
Every factual claim you make must be traceable to this content.

{context}{tool_context_block}"""


def _build_messages(
    system_prompt: str,
    history: list[ChatMessage],
    user_message: str,
) -> list[dict]:
    """Assemble the full message list for the LLM."""
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": user_message})
    return messages


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/{analysis_id}")
@limiter.limit("30/minute")  # Rate limit chat requests
async def chat_with_video(
    request: Request,
    analysis_id: UUID,
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Ask a question about a video using streaming RAG (vector search + LLM).

    Returns a text/event-stream with three event types:
    - ``{"type": "sources", "sources": [...]}``  — emitted first
    - ``{"type": "chunk", "content": "..."}``    — one per LLM token batch
    - ``[DONE]``                                 — stream terminator
    """
    # ── Resolve analysis → video ──────────────────────────────────────────
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    video_id = analysis.video_id
    video_result = await db.execute(select(Video).where(Video.id == video_id))
    if not video_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Video not found")

    # ── Credits ───────────────────────────────────────────────────────────
    await check_and_deduct(db, user.id, settings.CREDIT_COST_CHAT, "chat", str(video_id))

    # ── Embedding + vector search ─────────────────────────────────────────
    question_embedding = await _get_embedding(req.message)
    relevant_chunks = await _search_chunks(db, video_id, question_embedding, top_k=_CHUNK_TOP_K)

    if relevant_chunks:
        context = "\n\n".join(c["text"] for c in relevant_chunks)
        sources = [
            {"chunk_index": c["chunk_index"], "text": c["text"][:200]}
            for c in relevant_chunks
        ]
    else:
        logger.info(
            "No relevant chunks found for analysis=%s; falling back to full transcript.", analysis_id
        )
        t_result = await db.execute(
            select(Transcript).where(Transcript.video_id == video_id)
        )
        transcript = t_result.scalar_one_or_none()
        context = transcript.full_text[:_FALLBACK_CONTEXT_CHARS] if transcript else "No transcript available."
        sources = []

    # ── Chat history ──────────────────────────────────────────────────────
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.video_id == video_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(_HISTORY_LIMIT)
    )
    history = list(reversed(history_result.scalars().all()))

    # ── Build LLM payload ─────────────────────────────────────────────────
    message_lower = req.message.lower()
    auto_mission = req.tool_id
    
    # Intelligent Context Expansion & Mission Switching
    # If the user asks for a global synthesis/map, RAG is often too narrow.
    # Pull a larger transcript chunk to ensure global context.
    needs_global_context = any(word in message_lower for word in ["regenerate", "summary", "mindmap", "mind map", "roadmap", "comprehensive", "all", "whole"])
    
    if needs_global_context:
        logger.info("Global synthesis intent detected; expanding context window and bypassing RAG.")
        t_result = await db.execute(select(Transcript).where(Transcript.video_id == video_id))
        transcript = t_result.scalar_one_or_none()
        # Expand context to 15,000 chars for global requests
        context = transcript.full_text[:15000] if transcript else context
        
        # Auto-switch mission based on intent if not already set
        if not auto_mission or auto_mission == "ask":
            if "mind map" in message_lower or "mindmap" in message_lower:
                auto_mission = "mindmap"
            elif "roadmap" in message_lower:
                auto_mission = "roadmap"
            elif "summary" in message_lower or "synthesis" in message_lower:
                auto_mission = "synthesis"
            elif "glossary" in message_lower:
                auto_mission = "glossary"
            elif "resource" in message_lower:
                auto_mission = "resources"

    system_prompt = _build_system_prompt(context, auto_mission, req.context_snippet)
    messages = _build_messages(system_prompt, history, req.message)

    from app.services.ai_pipeline import _stream_ai_with_fallback

    provider = settings.DEFAULT_AI_PROVIDER
    model = settings.DEFAULT_AI_MODEL

    # ── Streaming generator ───────────────────────────────────────────────
    async def event_generator():
        # Emit sources first so the client can render citations immediately.
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        full_answer: list[str] = []
        try:
            async for chunk in _stream_ai_with_fallback(provider, model, messages):
                full_answer.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        except Exception as exc:
            logger.exception(
                "LLM streaming error for analysis=%s user=%s: %s", analysis_id, user.id, exc
            )
            yield f"data: {json.dumps({'type': 'error', 'message': 'Stream interrupted. Please retry.'})}\n\n"
            return

        # ── Persist to history ────────────────────────────────────────────
        final_answer = "".join(full_answer)
        try:
            db.add(ChatMessage(user_id=user.id, video_id=video_id, role="user", content=req.message))
            db.add(ChatMessage(user_id=user.id, video_id=video_id, role="assistant", content=final_answer))
            await db.commit()
        except Exception as exc:
            logger.error(
                "Failed to persist chat messages for analysis=%s: %s", analysis_id, exc
            )
            # Do NOT re-raise — the user already received the full answer; history loss is recoverable.

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",          # disable Nginx buffering for SSE
            "X-Sources-Count": str(len(sources)),
        },
    )


@router.get("/{analysis_id}/history", response_model=list[ChatMessageResponse])
async def get_chat_history(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
) -> list[ChatMessage]:
    """Get chat history for an analysis."""
    result = await db.execute(
        select(Analysis.video_id).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    video_id = result.scalar_one_or_none()
    if not video_id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.video_id == video_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------


async def _get_embedding(text: str) -> list[float]:
    """Generate a text embedding via the configured AI provider.

    Returns a zero-vector on failure so the caller can fall back gracefully.
    """
    from app.services.ai_pipeline import generate_embeddings

    try:
        embeddings = await generate_embeddings([text])
        if embeddings:
            return embeddings[0]
    except Exception as exc:
        logger.warning("Embedding generation failed, using zero-vector fallback: %s", exc)

    return [0.0] * settings.EMBEDDING_DIMENSION


async def _search_chunks(
    db: AsyncSession,
    video_id: UUID,
    embedding: list[float],
    top_k: int = _CHUNK_TOP_K,
    distance_threshold: float = _CHUNK_DISTANCE_THRESHOLD,
) -> list[dict]:
    """Search transcript chunks by cosine similarity.

    Chunks with a distance above *distance_threshold* are silently dropped
    so irrelevant content does not pollute the LLM context.
    """
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    result = await db.execute(
        text("""
            SELECT id, chunk_index, text, start_time, end_time,
                   embedding <=> CAST(:embedding AS vector) AS distance
            FROM transcript_chunks
            WHERE video_id = :video_id AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """),
        {"video_id": str(video_id), "embedding": embedding_str, "top_k": top_k},
    )

    rows = result.fetchall()
    chunks = [
        {
            "id": str(row.id),
            "chunk_index": row.chunk_index,
            "text": row.text,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "distance": row.distance,
        }
        for row in rows
        if row.distance is not None and row.distance <= distance_threshold
    ]

    if not chunks and rows:
        # All chunks exceeded the threshold — return the single closest one rather
        # than falling back to the full transcript unnecessarily.
        best = min(rows, key=lambda r: r.distance or float("inf"))
        logger.debug(
            "All chunks above threshold (%.3f); returning best match (distance=%.3f).",
            distance_threshold,
            best.distance,
        )
        chunks = [
            {
                "id": str(best.id),
                "chunk_index": best.chunk_index,
                "text": best.text,
                "start_time": best.start_time,
                "end_time": best.end_time,
                "distance": best.distance,
            }
        ]

    return chunks