import { useEffect, useRef, useState } from 'react';
import useOfflineStatus from '../hooks/useOfflineStatus';

export default function OfflineSyncStatus() {
  const { isOnline, pendingSync } = useOfflineStatus();
  const previousPendingSyncRef = useRef(pendingSync);
  const [showSynced, setShowSynced] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowSynced(false);
      setIsFading(false);
      previousPendingSyncRef.current = pendingSync;
      return;
    }

    if (previousPendingSyncRef.current > 0 && pendingSync === 0) {
      setShowSynced(true);
      setIsFading(false);
    }

    previousPendingSyncRef.current = pendingSync;
  }, [isOnline, pendingSync]);

  useEffect(() => {
    if (!showSynced) {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, 2500);

    const hideTimer = window.setTimeout(() => {
      setShowSynced(false);
      setIsFading(false);
    }, 3000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [showSynced]);

  if (!isOnline) {
    return (
      <div className="w-full bg-red-500 px-4 py-2 text-center text-sm font-medium text-white">
        You are offline
      </div>
    );
  }

  if (pendingSync > 0) {
    return (
      <div className="w-full bg-blue-500 px-4 py-2 text-center text-sm font-medium text-white">
        <span className="mr-2 inline-block animate-spin">🔄</span>
        Syncing {pendingSync} {pendingSync === 1 ? 'change' : 'changes'}
      </div>
    );
  }

  if (showSynced) {
    return (
      <div
        className={`w-full bg-green-500 px-4 py-2 text-center text-sm font-medium text-white transition-opacity duration-500 ${
          isFading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        All synced
      </div>
    );
  }

  return null;
}
