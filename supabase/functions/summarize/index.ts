import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchTranscript(videoId: string): Promise<string> {
  // Fetch YouTube page to extract captions
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await response.text();

  // Extract captions URL from the page
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!captionMatch) {
    // Fallback: try to get video description/metadata
    const descMatch = html.match(/"shortDescription":"(.*?)"/);
    if (descMatch) {
      return `Video description: ${descMatch[1].replace(/\\n/g, "\n").slice(0, 2000)}`;
    }
    throw new Error("No captions or description available for this video.");
  }

  const captionTracks = JSON.parse(captionMatch[1]);
  // Prefer English captions
  const track = captionTracks.find((t: any) => t.languageCode === "en") || captionTracks[0];
  if (!track?.baseUrl) throw new Error("No caption URL found.");

  const captionUrl = track.baseUrl.replace(/\\u0026/g, "&");
  const captionResp = await fetch(captionUrl);
  const captionXml = await captionResp.text();

  // Parse XML transcript
  const textSegments: string[] = [];
  const regex = /<text start="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(captionXml)) !== null) {
    const time = parseFloat(match[1]);
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

  return textSegments.join("\n");
}

function extractVideoInfo(html: string) {
  const titleMatch = html.match(/"title":"(.*?)"/);
  const channelMatch = html.match(/"ownerChannelName":"(.*?)"/);
  const viewMatch = html.match(/"viewCount":"(\d+)"/);
  const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
  const publishMatch = html.match(/"publishDate":"(.*?)"/);

  const lengthSec = lengthMatch ? parseInt(lengthMatch[1]) : 0;
  const mins = Math.floor(lengthSec / 60);
  const secs = lengthSec % 60;

  const views = viewMatch ? parseInt(viewMatch[1]) : 0;
  const formattedViews = views > 1000000
    ? `${(views / 1000000).toFixed(1)}M views`
    : views > 1000
    ? `${(views / 1000).toFixed(0)}K views`
    : `${views} views`;

  return {
    title: titleMatch ? titleMatch[1].replace(/\\"/g, '"') : "Unknown Title",
    channel: channelMatch ? channelMatch[1] : "Unknown Channel",
    duration: `${mins}:${secs.toString().padStart(2, "0")}`,
    views: formattedViews,
    published: publishMatch ? publishMatch[1] : "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    if (!videoId) throw new Error("videoId is required");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    // Fetch video page
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResp = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await pageResp.text();

    // Extract video info
    const videoInfo = extractVideoInfo(html);

    // Extract transcript
    let transcript: string;
    try {
      transcript = await fetchTranscript(videoId);
    } catch {
      transcript = `Video title: ${videoInfo.title}. No transcript available - summarize based on available metadata.`;
    }

    // Truncate transcript to fit context
    const maxChars = 12000;
    const truncatedTranscript = transcript.length > maxChars
      ? transcript.slice(0, maxChars) + "\n[transcript truncated]"
      : transcript;

    // Call Groq for summarization
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a YouTube video summarizer. Given a transcript, produce a structured JSON summary. Return ONLY valid JSON with this exact structure:
{
  "overview": "A 2-3 sentence overview of the video content",
  "keyPoints": ["point 1", "point 2", ...],
  "takeaways": ["takeaway 1", "takeaway 2", ...],
  "timestamps": [{"time": "0:00", "label": "Topic name"}, ...],
  "tags": ["tag1", "tag2", ...]
}

Rules:
- overview: 2-3 clear sentences summarizing the main topic
- keyPoints: 4-8 key points discussed in the video
- takeaways: 3-5 actionable takeaways
- timestamps: Extract 5-10 major topic changes from the transcript timestamps
- tags: 3-6 relevant topic tags
- Return ONLY the JSON object, no markdown, no code blocks`
          },
          {
            role: "user",
            content: `Video: "${videoInfo.title}" by ${videoInfo.channel}\n\nTranscript:\n${truncatedTranscript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq error:", groqResponse.status, errText);
      throw new Error(`AI summarization failed: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content;

    if (!content) throw new Error("No response from AI");

    // Parse the JSON response
    let summary;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      summary = JSON.parse(jsonMatch[1].trim());
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({
      videoInfo,
      summary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("summarize error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
