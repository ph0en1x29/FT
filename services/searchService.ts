import { supabase } from './supabaseClient';

export type SearchResult = {
  id: string;
  similarity: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

type MatchJobRow = {
  id: string;
  similarity: number;
};

type JobDetailsRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type JobEmbeddingRow = {
  id: string;
  embedding: number[] | null;
};

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function toPositiveLimit(limit: number, fallback: number): number {
  if (!Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.floor(limit));
}

function extractEmbedding(payload: unknown): number[] {
  if (isNumberArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const response = payload as Record<string, unknown>;
    const directCandidates = [response.embedding, response.vector, response.query_embedding];

    for (const candidate of directCandidates) {
      if (isNumberArray(candidate)) {
        return candidate;
      }
    }

    const nested = response.data;
    if (nested && typeof nested === 'object') {
      const nestedResponse = nested as Record<string, unknown>;
      const nestedCandidates = [
        nestedResponse.embedding,
        nestedResponse.vector,
        nestedResponse.query_embedding,
      ];

      for (const candidate of nestedCandidates) {
        if (isNumberArray(candidate)) {
          return candidate;
        }
      }
    }
  }

  throw new Error('Embedding response did not include a valid vector.');
}

function normalizeMatches(payload: unknown): MatchJobRow[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Record<string, unknown>;
      const id =
        typeof row.job_id === 'string'
          ? row.job_id
          : typeof row.job_id === 'string'
            ? row.job_id
            : null;
      const similarity = typeof row.similarity === 'number' ? row.similarity : null;

      if (!id || similarity === null) {
        return null;
      }

      return { id, similarity };
    })
    .filter((item): item is MatchJobRow => item !== null);
}

async function hydrateMatches(matches: MatchJobRow[]): Promise<SearchResult[]> {
  if (matches.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(matches.map((match) => match.id)));
  const { data, error } = await supabase
    .from('jobs')
    .select('job_id, title, description, status, created_at')
    .in('job_id', uniqueIds);
    .is('deleted_at', null)

  if (error) {
    throw new Error(`Failed to load job details: ${error.message}`);
  }

  const jobs = (data ?? []) as unknown as JobDetailsRow[];
  const byId = new Map(jobs.map((job) => [job.id, job]));

  return matches.map((match) => {
    const job = byId.get(match.id);

    return {
      id: match.id,
      similarity: match.similarity,
      title: job?.title ?? 'Untitled Job',
      description: job?.description ?? '',
      status: job?.status ?? 'unknown',
      created_at: job?.created_at ?? '',
    };
  });
}

export async function searchSimilarJobs(query: string, limit = 10): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();
  const matchLimit = toPositiveLimit(limit, 10);

  if (!trimmedQuery) {
    return [];
  }

  const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke(
    'generate-embedding',
    {
      body: { text: trimmedQuery },
    },
  );

  if (embeddingError) {
    throw new Error(`Failed to generate embedding: ${embeddingError.message}`);
  }

  const query_embedding = extractEmbedding(embeddingData);
  const { data: matchData, error: matchError } = await supabase.rpc('match_jobs', {
    query_embedding,
    match_count: matchLimit,
  });

  if (matchError) {
    throw new Error(`Failed to match jobs: ${matchError.message}`);
  }

  const matches = normalizeMatches(matchData).slice(0, matchLimit);
  return hydrateMatches(matches);
}

export async function findSimilarToJob(jobId: string, limit = 5): Promise<SearchResult[]> {
  const trimmedJobId = jobId.trim();
  const matchLimit = toPositiveLimit(limit, 5);

  if (!trimmedJobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('job_id, embedding')
    .eq('job_id', trimmedJobId)
    .single();

  if (error) {
    throw new Error(`Failed to load job embedding: ${error.message}`);
  }

  const job = data as unknown as JobEmbeddingRow | null;
  if (!job || !isNumberArray(job.embedding) || job.embedding.length === 0) {
    return [];
  }

  const { data: matchData, error: matchError } = await supabase.rpc('match_jobs', {
    query_embedding: job.embedding,
    match_count: matchLimit + 1,
  });

  if (matchError) {
    throw new Error(`Failed to match similar jobs: ${matchError.message}`);
  }

  const matches = normalizeMatches(matchData)
    .filter((match) => match.id !== trimmedJobId)
    .slice(0, matchLimit);

  return hydrateMatches(matches);
}
