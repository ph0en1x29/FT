import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenerateEmbeddingPayload = {
  jobId?: string;
  text?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { jobId, text } = (await req.json()) as GenerateEmbeddingPayload;

    if (!jobId || !text || !text.trim()) {
      return jsonResponse({ error: "jobId and text are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey || !openAIKey) {
      return jsonResponse(
        { error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY" },
        500,
      );
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!openAIResponse.ok) {
      const errorBody = await openAIResponse.text();
      return jsonResponse(
        { error: `OpenAI embedding request failed: ${openAIResponse.status}`, details: errorBody },
        502,
      );
    }

    const openAIData = await openAIResponse.json();
    const embedding = openAIData?.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return jsonResponse({ error: "OpenAI response missing embedding vector" }, 502);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("jobs")
      .update({ embedding })
      .eq("id", jobId)
      .select("id")
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    if (!data) {
      return jsonResponse({ error: "Job not found" }, 404);
    }

    return jsonResponse({
      jobId: data.id,
      dimensions: embedding.length,
      model: "text-embedding-3-small",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
