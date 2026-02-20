create extension if not exists vector;

alter table public.jobs
add column if not exists embedding vector(1536);

create index if not exists jobs_embedding_ivfflat_idx
on public.jobs
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

drop function if exists public.match_jobs(vector, float, int);

create or replace function public.match_jobs(
  query_embedding vector,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id text,
  similarity float
)
language sql
stable
as $$
  select
    j.job_id as id,
    1 - (j.embedding <=> query_embedding) as similarity
  from public.jobs as j
  where j.embedding is not null
    and 1 - (j.embedding <=> query_embedding) >= match_threshold
  order by j.embedding <=> query_embedding
  limit match_count;
$$;
