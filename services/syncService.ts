import { offlineStorageService, SyncQueueRecord } from './offlineStorageService';

export type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
};

const MAX_RETRIES = 5;
const TYPE_TO_URL: Record<string, string> = {
  'job-create': '/rest/v1/jobs',
  'job-update': '/rest/v1/jobs',
};
const supabaseBaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

let intervalId: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;
let processing = false;

function resolveEndpoint(type: string): string {
  const path = TYPE_TO_URL[type] ?? `/rest/v1/${type}`;

  if (/^https?:\/\//i.test(path) || !supabaseBaseUrl) {
    return path;
  }

  return path.startsWith('/') ? `${supabaseBaseUrl}${path}` : `${supabaseBaseUrl}/${path}`;
}

async function requeueEntry(
  entry: SyncQueueRecord,
  attempts: number,
  lastError?: string
): Promise<void> {
  await offlineStorageService.removeSyncQueueItem(entry.id);
  await offlineStorageService.enqueueSync({
    type: entry.type,
    payload: entry.payload,
    meta: entry.meta,
    attempts,
    lastError,
  });
}

async function getQueue(): Promise<SyncQueueRecord[]> {
  const queue = await offlineStorageService.getSyncQueue();
  return Array.isArray(queue) ? queue : [];
}

export async function processQueue(): Promise<SyncResult> {
  if (processing) {
    const pending = await getQueue();
    return { synced: 0, failed: 0, remaining: pending.length };
  }

  processing = true;

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getQueue();
    const orderedQueue = [...queue].sort((a, b) => a.createdAt - b.createdAt);

    for (const entry of orderedQueue) {
      const retries = entry.attempts ?? 0;

      if (retries >= MAX_RETRIES) {
        failed += 1;
        continue;
      }

      try {
        const response = await fetch(resolveEndpoint(entry.type), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry.payload ?? null),
        });

        if (response.ok) {
          await offlineStorageService.removeSyncQueueItem(entry.id);
          synced += 1;
        } else {
          await requeueEntry(entry, Math.min(retries + 1, MAX_RETRIES), `HTTP ${response.status}`);
          failed += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        await requeueEntry(entry, Math.min(retries + 1, MAX_RETRIES), message);
        failed += 1;
      }
    }

    const remainingQueue = await getQueue();
    return { synced, failed, remaining: remainingQueue.length };
  } finally {
    processing = false;
  }
}

export function startAutoSync(interval = 30000): void {
  stopAutoSync();

  onlineHandler = () => {
    void processQueue();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onlineHandler);
  }

  intervalId = setInterval(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      void processQueue();
    }
  }, interval);
}

export function stopAutoSync(): void {
  if (onlineHandler && typeof window !== 'undefined') {
    window.removeEventListener('online', onlineHandler);
  }

  onlineHandler = null;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
