const OFFLINE_DB_NAME = 'fieldpro-offline';
const OFFLINE_DB_VERSION = 1;

const PINNED_JOBS_STORE = 'pinned_jobs';
const SYNC_QUEUE_STORE = 'sync_queue';

export const OFFLINE_QUEUE_UPDATED_EVENT = 'fieldpro:offline-queue-updated';

export interface PinnedJobRecord {
  jobId: string;
  jobData?: unknown;
  pinnedAt: number;
  updatedAt: number;
}

export interface SyncQueueRecord {
  id: string;
  type: string;
  payload: unknown;
  meta?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

interface EnqueueSyncInput {
  type: string;
  payload: unknown;
  meta?: Record<string, unknown>;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function emitQueueUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
}

function createQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `queue_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function getDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is not available in this environment.');
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(PINNED_JOBS_STORE)) {
          database.createObjectStore(PINNED_JOBS_STORE, { keyPath: 'jobId' });
        }

        if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const queueStore = database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
  }

  return databasePromise;
}

async function pinJob(jobId: string, jobData?: unknown): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(PINNED_JOBS_STORE, 'readwrite');
  const store = transaction.objectStore(PINNED_JOBS_STORE);
  const now = Date.now();

  store.put({
    jobId,
    jobData,
    pinnedAt: now,
    updatedAt: now,
  } satisfies PinnedJobRecord);

  await transactionDone(transaction);
}

async function unpinJob(jobId: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(PINNED_JOBS_STORE, 'readwrite');
  transaction.objectStore(PINNED_JOBS_STORE).delete(jobId);
  await transactionDone(transaction);
}

async function isJobPinned(jobId: string): Promise<boolean> {
  const database = await getDatabase();
  const transaction = database.transaction(PINNED_JOBS_STORE, 'readonly');
  const store = transaction.objectStore(PINNED_JOBS_STORE);
  const record = await requestToPromise<PinnedJobRecord | undefined>(store.get(jobId));
  return Boolean(record);
}

async function getPinnedJobs(): Promise<PinnedJobRecord[]> {
  const database = await getDatabase();
  const transaction = database.transaction(PINNED_JOBS_STORE, 'readonly');
  const store = transaction.objectStore(PINNED_JOBS_STORE);
  const records = await requestToPromise<PinnedJobRecord[]>(store.getAll());
  return records;
}

async function enqueueSync(input: EnqueueSyncInput): Promise<SyncQueueRecord> {
  const database = await getDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const store = transaction.objectStore(SYNC_QUEUE_STORE);

  const record: SyncQueueRecord = {
    id: createQueueId(),
    type: input.type,
    payload: input.payload,
    meta: input.meta,
    createdAt: Date.now(),
    attempts: 0,
  };

  store.put(record);
  await transactionDone(transaction);
  emitQueueUpdated();

  return record;
}

async function getSyncQueue(): Promise<SyncQueueRecord[]> {
  const database = await getDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, 'readonly');
  const store = transaction.objectStore(SYNC_QUEUE_STORE);
  const records = await requestToPromise<SyncQueueRecord[]>(store.getAll());
  return records.sort((a, b) => a.createdAt - b.createdAt);
}

async function getSyncQueueCount(): Promise<number> {
  const database = await getDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, 'readonly');
  const countRequest = transaction.objectStore(SYNC_QUEUE_STORE).count();
  return requestToPromise<number>(countRequest);
}

async function removeSyncQueueItem(id: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, 'readwrite');
  transaction.objectStore(SYNC_QUEUE_STORE).delete(id);
  await transactionDone(transaction);
  emitQueueUpdated();
}

async function clearSyncQueue(): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, 'readwrite');
  transaction.objectStore(SYNC_QUEUE_STORE).clear();
  await transactionDone(transaction);
  emitQueueUpdated();
}

export const offlineStorageService = {
  pinJob,
  unpinJob,
  isJobPinned,
  getPinnedJobs,
  enqueueSync,
  getSyncQueue,
  getSyncQueueCount,
  removeSyncQueueItem,
  clearSyncQueue,
};
