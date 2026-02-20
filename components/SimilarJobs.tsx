import { useEffect, useState } from 'react';
import { findSimilarToJob } from '../services/searchService';

type SimilarJobsProps = {
  jobId: string;
};

type SimilarJob = {
  id: string;
  title: string;
  similarity: number;
  date: string;
  status: string;
};

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeJobs(input: unknown): SimilarJob[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const row = item as Record<string, unknown>;
    const id = getString(row.id);
    const title = getString(row.title) ?? getString(row.job_title);
    const similarity = getNumber(row.similarity) ?? getNumber(row.score) ?? 0;
    const date = getString(row.date) ?? getString(row.created_at) ?? '';
    const status = getString(row.status) ?? 'Unknown';

    if (!id || !title) {
      return [];
    }

    return [{ id, title, similarity, date, status }];
  });
}

function formatSimilarity(similarity: number): string {
  const normalized = similarity <= 1 ? similarity * 100 : similarity;
  const bounded = Math.max(0, Math.min(100, normalized));
  return `${Math.round(bounded)}%`;
}

function formatDate(dateValue: string): string {
  if (!dateValue) {
    return '-';
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString();
}

export default function SimilarJobs({ jobId }: SimilarJobsProps) {
  const [jobs, setJobs] = useState<SimilarJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSimilarJobs(): Promise<void> {
      setIsLoading(true);

      try {
        const result = await findSimilarToJob(jobId);
        if (cancelled) {
          return;
        }
        setJobs(normalizeJobs(result).slice(0, 5));
      } catch {
        if (!cancelled) {
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSimilarJobs();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <details open className="rounded-lg border border-theme bg-theme-card">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-theme">
        Similar Jobs
      </summary>

      <div className="space-y-2 px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2 pt-1">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-theme-muted">No similar jobs found</p>
        ) : (
          jobs.map((job) => (
            <a
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block rounded-md border border-theme p-3 transition-colors hover:bg-theme-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-medium text-theme">{job.title}</h3>
                <span className="shrink-0 rounded-full bg-theme-surface-2 px-2 py-0.5 text-xs font-semibold text-theme">
                  {formatSimilarity(job.similarity)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-theme-muted">
                <span>{formatDate(job.date)}</span>
                <span className="rounded border border-theme px-2 py-0.5">{job.status}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </details>
  );
}
