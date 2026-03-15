// Video Tutor Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const { question, transcript, history, provider = "groq", model = "llama-3.3-70b-versatile" } = await req.json();

        if (!question) throw new Error("question is required");
        if (!transcript) throw new Error("transcript is required");

        const envKey = `${provider.toUpperCase()}_API_KEY`;
        // @ts-expect-error: Deno is available in Supabase Edge Functions
        const apiKey = Deno.env.get(envKey);
        if (!apiKey) throw new Error(`${envKey} is not configured`);

        const messages = [
            {
                role: "system",
                content: `You are an expert AI tutor with deep knowledge of the video content provided. 
You have access to the full transcript and context of the video(s) the user is watching.
Answer questions based PRIMARILY on the video content. Be conversational, helpful, and detailed.
If a timestamp is relevant, mention it like [2:45].
If the question is not about the video, still help but note that it's a general answer.

VIDEO TRANSCRIPT/CONTEXT:
${transcript.slice(0, 14000)}`
            },
            ...history.map((h: { role: string; content: string }) => ({ role: h.role, content: h.content })),
            { role: "user", content: question }
        ];

        let url = "";
        if (provider === "groq") url = "https://api.groq.com/openai/v1/chat/completions";
        else if (provider === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
        else if (provider === "xai") url = "https://api.x.ai/v1/chat/completions";
        else if (provider === "cerebras") url = "https://api.cerebras.ai/v1/chat/completions";
        else url = "https://api.groq.com/openai/v1/chat/completions";

        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                ...(provider === "openrouter" && { "HTTP-Referer": "https://lovable.dev", "X-Title": "Youtube Genius" })
            },
            body: JSON.stringify({
                model: provider === "openrouter" ? "meta-llama/llama-3.3-70b-instruct:free" : model,
                messages,
                temperature: 0.5,
                max_tokens: 2000,
            })
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error?.message || `AI error: ${resp.status}`);

        const answer = data.choices?.[0]?.message?.content;
        return new Response(JSON.stringify({ answer }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
