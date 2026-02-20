import { useEffect, useState } from 'react';
import { cacheJobs } from '../services/offlineStorageService';

type PinJobButtonProps = {
  jobId: string;
  jobData: any;
};

const STORAGE_KEY = 'pinned-jobs';

const getPinnedJobs = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function PinJobButton({ jobId, jobData }: PinJobButtonProps) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const pinnedJobs = getPinnedJobs();
    setIsPinned(pinnedJobs.includes(jobId));
  }, [jobId]);

  const togglePin = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const pinnedJobs = getPinnedJobs();

    if (pinnedJobs.includes(jobId)) {
      const updated = pinnedJobs.filter((id) => id !== jobId);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setIsPinned(false);
      return;
    }

    const updated = Array.from(new Set([...pinnedJobs, jobId]));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setIsPinned(true);
    await cacheJobs([jobData]);
  };

  return (
    <button
      type="button"
      onClick={togglePin}
      className="rounded-md border border-theme bg-theme-card px-3 py-2 text-lg transition-colors hover:bg-theme-surface-2"
      aria-label={isPinned ? 'Unpin job' : 'Pin job'}
      title={isPinned ? 'Unpin job' : 'Pin job'}
    >
      {isPinned ? '📌' : '📍'}
    </button>
  );
}
