// Supabase Edge Function — generate embeddings using built-in gte-small
// No external API key required

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const session = new Supabase.ai.Session('gte-small');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const { jobId, text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "text" field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate embedding using built-in gte-small (384 dimensions)
    const embedding = await session.run(text, {
      mean_pool: true,
      normalize: true,
    });

    // If jobId provided, store directly in the jobs table
    if (jobId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error } = await supabase
        .from('jobs')
        .update({ embedding: Array.from(embedding) })
        .eq('job_id', jobId);

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to store embedding: ${error.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dimensions: 384,
        embedding: jobId ? undefined : Array.from(embedding),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
