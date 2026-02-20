import { useEffect, useState } from 'react';
import { offlineStorageService } from '../services/offlineStorageService';

type PinJobButtonProps = {
  jobId: string;
  jobData: any;
};

export default function PinJobButton({ jobId, jobData }: PinJobButtonProps) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkPinnedStatus = async () => {
      try {
        const pinned = await offlineStorageService.isJobPinned(jobId);
        if (mounted) {
          setIsPinned(pinned);
        }
      } catch {
        if (mounted) {
          setIsPinned(false);
        }
      }
    };

    void checkPinnedStatus();

    return () => {
      mounted = false;
    };
  }, [jobId]);

  const togglePin = async () => {
    try {
      if (isPinned) {
        await offlineStorageService.unpinJob(jobId);
        setIsPinned(false);
        return;
      }

      await offlineStorageService.pinJob(jobId, jobData);
      setIsPinned(true);
    } catch {
      // Keep current UI state if persistence fails.
    }
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
