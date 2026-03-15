// YouTube Summarizer Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SummaryRequest {
  videoId?: string;
  videoIds?: string[];
  model?: string;
  provider?: string;
  language?: string;
  style?: string;
  expertise?: string;
  chatHistory?: { role: string; content: string }[];
}

async function fetchTranscript(videoId: string, maxSeconds: number = 0): Promise<{ transcript: string; textSegments: string[] }> {
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await response.text();

  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!captionMatch) {
    const descMatch = html.match(/"shortDescription":"(.*?)"/);
    if (descMatch) {
      return { transcript: `Video description fallback: ${descMatch[1].replace(/\\n/g, "\n").slice(0, 4000)}`, textSegments: [] };
    }
    throw new Error("No captions available.");
  }

  const captionTracks = JSON.parse(captionMatch[1]);
  // Prioritize English, then any other
  const track = captionTracks.find((t: { languageCode: string }) => t.languageCode === "en") || captionTracks[0];
  if (!track?.baseUrl) throw new Error("No caption URL found.");

  const captionUrl = track.baseUrl.replace(/\\u0026/g, "&");
  const captionResp = await fetch(captionUrl);
  const captionXml = await captionResp.text();

  const textSegments: string[] = [];
  const regex = /<text start="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(captionXml)) !== null) {
    const time = parseFloat(match[1]);
    // Stop if we exceed duration (some transcripts have ghost data or are from combined tracks)
    if (maxSeconds > 0 && time > maxSeconds + 5) break; 
    
    const text = match[2]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/<[^>]*>/g, "");
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    textSegments.push(`[${mins}:${secs.toString().padStart(2, "0")}] ${text}`);
  }

  return { transcript: textSegments.join("\n"), textSegments };
}

function extractVideoInfo(html: string) {
  const titleMatch = html.match(/"title":"(.*?)"/);
  const channelMatch = html.match(/"ownerChannelName":"(.*?)"/);
  const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
  const publishMatch = html.match(/"publishDate":"(.*?)"/);
  const keywordsMatch = html.match(/<meta name="keywords" content="(.*?)"/);
  const descMatch = html.match(/"shortDescription":"(.*?)"/);

  // Robust View Extraction
  const viewCountMatch = html.match(/"viewCount":"(\d+)"/);
  const viewSimpleMatch = html.match(/"viewCount":\{"simpleText":"(.*?)"\}/);
  const viewShortMatch = html.match(/"shortViewCountText":\{"accessibility":\{"accessibilityData":\{"label":"(.*?)"\}\}/);

  let views = 0;
  let formattedViews = "0 views";

  if (viewCountMatch) {
    views = parseInt(viewCountMatch[1]);
  } else if (viewSimpleMatch) {
    const text = viewSimpleMatch[1].replace(/,/g, "");
    views = parseInt(text) || 0;
    formattedViews = viewSimpleMatch[1];
  }

  if (views > 0) {
    formattedViews = views > 1000000
      ? `${(views / 1000000).toFixed(1)}M views`
      : views > 1000
        ? `${(views / 1000).toFixed(0)}K views`
        : `${views} views`;
  } else if (viewShortMatch) {
    formattedViews = viewShortMatch[1];
  }

  // Robust Like Extraction
  const likeFactoidMatch = html.match(/"factoidRenderer":{"value":{"simpleText":"(.*?)"},"label":{"simpleText":"Likes"}}/);
  const likeCountMatch = html.match(/"likeCount":"(\d+)"/);
  const likeAccessMatch = html.match(/"accessibilityData":{"label":"([\d,MKB.]+)\s*(?:likes|like this video)/i);

  let likes = "0";
  if (likeFactoidMatch) {
    likes = likeFactoidMatch[1];
  } else if (likeAccessMatch) {
    likes = likeAccessMatch[1];
  } else if (likeCountMatch) {
    const count = parseInt(likeCountMatch[1]);
    likes = count > 1000000 ? `${(count / 1000000).toFixed(1)}M` : count > 1000 ? `${(count / 1000).toFixed(0)}K` : count.toString();
  }

  const lengthSec = lengthMatch ? parseInt(lengthMatch[1]) : 0;
  const mins = Math.floor(lengthSec / 60);
  const secs = lengthSec % 60;

  return {
    title: titleMatch ? titleMatch[1].replace(/\\"/g, '"') : "Unknown Title",
    channel: channelMatch ? channelMatch[1] : "Unknown Channel",
    duration: `${mins}:${secs.toString().padStart(2, "0")}`,
    views: formattedViews,
    likes,
    published: publishMatch ? publishMatch[1] : "",
    keywords: keywordsMatch ? keywordsMatch[1] : "",
    description: descMatch ? descMatch[1].replace(/\\n/g, "\n") : "",
  };
}

async function callAI(provider: string, model: string, messages: { role: string; content: string }[], apiKey: string) {
  let url = "";
  if (provider === "groq") url = "https://api.groq.com/openai/v1/chat/completions";
  else if (provider === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
  else if (provider === "google") url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  else if (provider === "xai") url = "https://api.x.ai/v1/chat/completions";
  else if (provider === "cerebras") url = "https://api.cerebras.ai/v1/chat/completions";

  if (provider === "google") {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: messages[0].content + "\n\n" + messages[1].content }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
      })
    });
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter" && { "HTTP-Referer": "https://lovable.dev", "X-Title": "Youtube Genius" })
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    })
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `AI error: ${resp.status}`);
  return data.choices?.[0]?.message?.content;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const body: SummaryRequest = await req.json();
    const { 
      videoId, 
      videoIds: rawVideoIds, 
      provider = "groq", 
      model = "llama-3.3-70b-versatile", 
      language = "English", 
      style = "Detailed",
      expertise = "Intermediate"
    } = body;

    const videoIds: string[] = rawVideoIds && rawVideoIds.length > 0
      ? rawVideoIds.filter(Boolean).slice(0, 3)
      : videoId ? [videoId] : [];

    if (videoIds.length === 0) throw new Error("videoId or videoId array is required");

    const envKey = `${provider.toUpperCase()}_API_KEY`;
    // @ts-expect-error: Deno is available in Supabase Edge Functions
    const apiKey = Deno.env.get(envKey);
    if (!apiKey) throw new Error(`${envKey} is not configured on Supabase Dashboard`);

    const videoDataArr: { videoInfo: Record<string, unknown>; transcript: string }[] = [];
    let primaryVideoInfo: Record<string, unknown> | null = null;

    for (const vid of videoIds) {
      const pageUrl = `https://www.youtube.com/watch?v=${vid}`;
      const pageResp = await fetch(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US,en;q=0.9" }
      });
      const html = await pageResp.text();
      
      // Get raw duration for filtering
      const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
      const lengthSec = lengthMatch ? parseInt(lengthMatch[1]) : 0;
      
      const videoInfo = extractVideoInfo(html);
      if (!primaryVideoInfo) primaryVideoInfo = videoInfo;

      let transcript: string;
      try {
        const transcriptData = await fetchTranscript(vid, lengthSec);
        transcript = transcriptData.transcript;
      } catch {
        transcript = `[NO CAPTIONS — FALLBACK CONTEXT]\nTitle: ${videoInfo.title}\nChannel: ${videoInfo.channel}\nKeywords: ${videoInfo.keywords}\nDescription:\n${videoInfo.description.slice(0, 3000)}`;
      }

      videoDataArr.push({ videoInfo, transcript });
    }

    const isMultiVideo = videoIds.length > 1;
    const combinedContext = videoDataArr.map((vd, i) =>
      `=== VIDEO ${i + 1}: "${vd.videoInfo.title}" by ${vd.videoInfo.channel} ===\n${vd.transcript.slice(0, Math.floor(15000 / videoIds.length))}`
    ).join("\n\n");

    const systemPrompt = `You are an expert educational AI assistant and YouTube video analyst. 
${isMultiVideo ? "You are given MULTIPLE videos. Synthesize them into one unified Master Guide, comparing and combining their insights." : ""}
The target audience expertise level is: ${expertise}. Adjust the depth, terminology, and complexity level to match ${expertise}.
${body.chatHistory ? `Previous Chat Messages for context:\n${JSON.stringify(body.chatHistory)}` : ""}
Respond in ${language}. Style: ${style}.
Return ONLY valid JSON (no markdown, no code blocks) with this EXACT structure:
{
  "overview": "3-5 paragraphs of massively detailed analysis${isMultiVideo ? " comparing and synthesizing all videos" : ""}",
  "keyPoints": ["10-15 highly detailed insight strings"],
  "takeaways": ["6-10 actionable takeaway strings"],
  "timestamps": [{"time": "0:00", "label": "Topic description"}],
  "roadmap": {
    "title": "Mastery Roadmap",
    "steps": [{"step": 1, "task": "Task name", "description": "How to accomplish it in detail"}]
  },
  "learningContext": {
    "why": "Deep explanation of why this topic matters",
    "whatToHowTo": "Specific step-by-step guidance on what to learn and in what order",
    "bestWay": "The most effective and proven approach to mastering this topic"
  },
  "quiz": [
    {
      "question": "A clear question testing understanding of the content",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why this answer is correct, with context from the video"
    }
  ],
  "mindMap": {
    "nodes": [{"id": "1", "label": "Central Topic"}, {"id": "2", "label": "Sub-concept"}],
    "edges": [{"source": "1", "target": "2", "label": "relates to"}]
  },
  "tags": ["tag1", "tag2"],
  "flashcards": [
    {
      "front": "A key concept or question",
      "back": "The detailed explanation or answer"
    }
  ]
}
Rules:
- Respond in ${language}. Generate very detailed content.`;

    const content = await callAI(provider, model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: combinedContext }
    ], apiKey);

    if (!content) throw new Error(`AI Provider (${provider}) returned an empty response.`);

    let summary;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      summary = JSON.parse(jsonString);
    } catch {
      throw new Error(`Failed to parse AI JSON response.`);
    }

    const allTranscripts = isMultiVideo 
      ? videoDataArr.map((vd, i) => `[Video ${i + 1}: ${vd.videoInfo.title}]\n${vd.transcript}`).join("\n\n---\n\n")
      : videoDataArr[0]?.transcript || "";

    return new Response(JSON.stringify({
      videoInfo: primaryVideoInfo,
      allVideoInfo: videoDataArr.map(vd => vd.videoInfo),
      summary,
      transcript: videoDataArr[0]?.transcript || "",
      allTranscripts,
      metadata: { provider, model, language, style, videoCount: videoIds.length }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error",
      details: "Check Supabase logs."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
