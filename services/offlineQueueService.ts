/**
 * Offline Queue Service
 * 
 * Stores pending actions when offline and syncs when connection is restored.
 * Uses IndexedDB for persistence across sessions.
 */

interface QueuedAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

const DB_NAME = 'fieldpro_offline';
const STORE_NAME = 'pending_actions';
const MAX_RETRIES = 3;

class OfflineQueueService {
  private db: IDBDatabase | null = null;
  private isProcessing = false;
  private handlers: Map<string, (payload: Record<string, unknown>) => Promise<void>> = new Map();

  constructor() {
    this.initDB();
    this.setupNetworkListeners();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.processQueue();
    });
  }

  /**
   * Register a handler for a specific action type
   */
  registerHandler(type: string, handler: (payload: Record<string, unknown>) => Promise<void>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add an action to the offline queue
   */
  async enqueue(type: string, payload: Record<string, unknown>): Promise<string> {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    await this.saveAction(action);

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }

    return action.id;
  }

  /**
   * Remove an action from the queue (e.g., when undoing)
   */
  async dequeue(id: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<QueuedAction[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get count of pending actions
   */
  async getPendingCount(): Promise<number> {
    const actions = await this.getPendingActions();
    return actions.length;
  }

  /**
   * Process all pending actions
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    
    this.isProcessing = true;

    try {
      const actions = await this.getPendingActions();
      
      for (const action of actions) {
        const handler = this.handlers.get(action.type);
        
        if (!handler) {
          console.warn(`No handler registered for action type: ${action.type}`);
          continue;
        }

        try {
          await handler(action.payload);
          await this.dequeue(action.id);
        } catch (error) {
          // Increment retry count
          action.retries++;
          
          if (action.retries >= MAX_RETRIES) {
            console.error(`Action ${action.id} failed after ${MAX_RETRIES} retries`, error);
            await this.dequeue(action.id);
          } else {
            await this.saveAction(action);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async saveAction(action: QueuedAction): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(action);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Clear all pending actions
   */
  async clearQueue(): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueueService();

// Helper to wrap API calls with offline support
export async function withOfflineSupport<T>(
  actionType: string,
  payload: Record<string, unknown>,
  onlineAction: () => Promise<T>,
  offlineMessage: string = 'Action queued for when you\'re back online'
): Promise<T | null> {
  if (navigator.onLine) {
    return onlineAction();
  } else {
    await offlineQueue.enqueue(actionType, payload);
    // Import dynamically to avoid circular deps
    const { showToast } = await import('./toastService');
    showToast.info(offlineMessage);
    return null;
  }
}

export default offlineQueue;
