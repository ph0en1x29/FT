-- pgvector semantic search for FieldPro jobs
-- Uses Supabase built-in gte-small model (384 dimensions, no external API key)

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- IVFFlat index (create after inserting initial embeddings for best performance)
-- Run this after backfilling: CREATE INDEX jobs_embedding_ivfflat_idx ON public.jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

DROP FUNCTION IF EXISTS public.match_jobs(vector, float, int);

CREATE OR REPLACE FUNCTION public.match_jobs(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    j.job_id AS id,
    1 - (j.embedding <=> query_embedding) AS similarity
  FROM public.jobs AS j
  WHERE j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
$$;
