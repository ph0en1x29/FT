import { useEffect, useState } from 'react';
import { offlineStorageService } from '../services/offlineStorageService';

type OfflineStatus = {
  isOnline: boolean;
  pendingSync: number;
  lastSyncAt: Date | null;
};

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [pendingSync, setPendingSync] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const refreshQueueCount = async (): Promise<void> => {
      try {
        const queueCount = await offlineStorageService.getSyncQueueCount();
        if (!mounted) {
          return;
        }
        setPendingSync(queueCount);
        if (typeof navigator === 'undefined' || navigator.onLine) {
          setLastSyncAt(new Date());
        }
      } catch {
        if (mounted) {
          setPendingSync(0);
        }
      }
    };

    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    void refreshQueueCount();
    const pollId = setInterval(() => {
      void refreshQueueCount();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(pollId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return { isOnline, pendingSync, lastSyncAt };
}

export default useOfflineStatus;
