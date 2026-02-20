import { FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import useOfflineStatus from '../hooks/useOfflineStatus';
import { addToSyncQueue } from '../services/offlineStorageService';

type OfflineFormWrapperProps = {
  onSubmit: (data: any) => Promise<void>;
  children: ReactNode;
  entityType: string;
};

export default function OfflineFormWrapper({
  onSubmit,
  children,
  entityType,
}: OfflineFormWrapperProps) {
  const { isOnline } = useOfflineStatus();
  const [savedOffline, setSavedOffline] = useState(false);
  const hideMessageTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideMessageTimeoutRef.current !== null) {
        window.clearTimeout(hideMessageTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());

    if (isOnline) {
      await onSubmit(formData);
      setSavedOffline(false);
      return;
    }

    await addToSyncQueue({
      entityType,
      action: 'create',
      data: formData,
      queuedAt: new Date().toISOString(),
    } as any);

    setSavedOffline(true);
    if (hideMessageTimeoutRef.current !== null) {
      window.clearTimeout(hideMessageTimeoutRef.current);
    }

    hideMessageTimeoutRef.current = window.setTimeout(() => {
      setSavedOffline(false);
    }, 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {children}
      {savedOffline ? (
        <p className="text-sm font-medium text-theme-muted">Saved offline</p>
      ) : null}
    </form>
  );
}
