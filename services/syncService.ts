import * as offlineStorageService from './offlineStorageService';

type SyncQueueEntry = {
  id: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  retries?: number;
  createdAt?: number | string;
  timestamp?: number | string;
};

type OfflineStorageApi = {
  getSyncQueue: () => Promise<SyncQueueEntry[]> | SyncQueueEntry[];
  removeSyncQueueEntry?: (id: string) => Promise<void> | void;
  removeFromSyncQueue?: (id: string) => Promise<void> | void;
  updateSyncQueueEntry?: (entry: SyncQueueEntry) => Promise<void> | void;
  updateSyncQueueItem?: (entry: SyncQueueEntry) => Promise<void> | void;
};

export type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
};

const MAX_RETRIES = 5;
const storage = offlineStorageService as unknown as OfflineStorageApi;

let intervalId: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;
let processing = false;

function getEntryOrderValue(entry: SyncQueueEntry): number {
  const raw = entry.createdAt ?? entry.timestamp;
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function removeEntry(id: string): Promise<void> {
  if (storage.removeSyncQueueEntry) {
    await storage.removeSyncQueueEntry(id);
    return;
  }
  if (storage.removeFromSyncQueue) {
    await storage.removeFromSyncQueue(id);
  }
}

async function updateEntry(entry: SyncQueueEntry): Promise<void> {
  if (storage.updateSyncQueueEntry) {
    await storage.updateSyncQueueEntry(entry);
    return;
  }
  if (storage.updateSyncQueueItem) {
    await storage.updateSyncQueueItem(entry);
  }
}

async function getQueue(): Promise<SyncQueueEntry[]> {
  const queue = await Promise.resolve(storage.getSyncQueue());
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
    const orderedQueue = [...queue].sort((a, b) => getEntryOrderValue(a) - getEntryOrderValue(b));

    for (const entry of orderedQueue) {
      const retries = entry.retries ?? 0;

      if (retries >= MAX_RETRIES) {
        failed += 1;
        continue;
      }

      try {
        const response = await fetch(entry.url, {
          method: entry.method ?? 'POST',
          headers: entry.headers,
          body:
            entry.body == null || typeof entry.body === 'string'
              ? (entry.body as string | undefined)
              : JSON.stringify(entry.body),
        });

        if (response.ok) {
          await removeEntry(entry.id);
          synced += 1;
        } else {
          await updateEntry({ ...entry, retries: Math.min(retries + 1, MAX_RETRIES) });
          failed += 1;
        }
      } catch {
        await updateEntry({ ...entry, retries: Math.min(retries + 1, MAX_RETRIES) });
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
