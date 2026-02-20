import { useCallback, useEffect, useRef, useState } from 'react';

import { SearchResult, searchSimilarJobs } from '../services/searchService';

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 10;
const SKELETON_ROWS = [0, 1, 2];

function formatSimilarity(similarity: number): string {
  const value = similarity <= 1 ? similarity * 100 : similarity;
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${safeValue.toFixed(1)}%`;
}

function formatDate(createdAt: string): string {
  if (!createdAt) {
    return 'Unknown date';
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleDateString();
}

function getSnippet(description: string, maxLength = 160): string {
  const trimmed = description.trim();
  if (!trimmed) {
    return 'No description provided.';
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function getStatusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === 'open' || normalized === 'active') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (normalized === 'in_progress' || normalized === 'in progress') {
    return 'bg-amber-100 text-amber-800';
  }

  if (normalized === 'closed' || normalized === 'complete' || normalized === 'completed') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-theme-surface-2 text-theme';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unable to run semantic search right now.';
}

export function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const runSearch = useCallback(async (searchTerm: string) => {
    const requestId = ++activeRequestRef.current;

    if (!searchTerm) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextResults = await searchSimilarJobs(searchTerm, RESULT_LIMIT);
      if (requestId !== activeRequestRef.current) {
        return;
      }

      setResults(nextResults);
    } catch (caughtError) {
      if (requestId !== activeRequestRef.current) {
        return;
      }

      setResults([]);
      setError(getErrorMessage(caughtError));
    } finally {
      if (requestId === activeRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const handleRetry = useCallback(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  return (
    <section className="rounded-xl border border-theme bg-theme-card p-4">
      <div>
        <label htmlFor="semantic-search-input" className="mb-2 block text-sm font-semibold text-theme">
          Semantic Job Search
        </label>
        <input
          id="semantic-search-input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search jobs by intent..."
          className="w-full rounded-lg border border-theme bg-theme-surface-2 px-3 py-2 text-sm text-theme placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-2 text-xs text-theme-muted">Results update after 300ms of inactivity.</p>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <ul className="space-y-3">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className="animate-pulse rounded-lg border border-theme bg-theme-surface-2 p-4">
                <div className="h-4 w-1/3 rounded bg-theme-card" />
                <div className="mt-3 h-3 w-full rounded bg-theme-card" />
                <div className="mt-2 h-3 w-2/3 rounded bg-theme-card" />
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && !error && debouncedQuery && results.length === 0 ? (
          <div className="rounded-lg border border-theme bg-theme-surface-2 p-4 text-sm text-theme-muted">
            No matching jobs found.
          </div>
        ) : null}

        {!isLoading && !error && results.length > 0 ? (
          <ul className="space-y-3">
            {results.map((result) => (
              <li key={result.id} className="rounded-lg border border-theme bg-theme-surface-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-theme">{result.title}</h3>
                    <p className="mt-1 text-xs text-theme-muted">{formatDate(result.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                        result.status,
                      )}`}
                    >
                      {result.status || 'unknown'}
                    </span>
                    <span className="rounded-full border border-theme px-2 py-0.5 text-xs font-semibold text-theme">
                      {formatSimilarity(result.similarity)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-theme-muted">{getSnippet(result.description)}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {!debouncedQuery && !isLoading ? (
          <p className="text-sm text-theme-muted">Type a phrase to find semantically related jobs.</p>
        ) : null}
      </div>
    </section>
  );
}
