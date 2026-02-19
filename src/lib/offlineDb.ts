/**
 * IndexedDB service for offline data storage and sync queue management
 * Enhanced for comprehensive mobile offline support
 */

const DB_NAME = 'fieldtek-offline';
const DB_VERSION = 2; // Bumped for new stores

export interface QueuedOperation {
  id: string;
  type: 'job_status_update' | 'job_checklist_update' | 'job_notes_update';
  payload: Record<string, any>;
  createdAt: string;
  retryCount: number;
}

export interface CachedJob {
  id: string;
  data: Record<string, any>;
  cachedAt: string;
}

export interface CachedClient {
  id: string;
  data: Record<string, any>;
  cachedAt: string;
}

export interface CachedChecklist {
  jobId: string;
  items: Record<string, any>[];
  cachedAt: string;
}

export interface OfflineMetadata {
  key: string;
  value: any;
  updatedAt: string;
}

let db: IDBDatabase | null = null;

export async function initOfflineDb(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Store for queued operations (to sync when online)
      if (!database.objectStoreNames.contains('sync_queue')) {
        const syncStore = database.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      // Store for cached jobs (for offline viewing)
      if (!database.objectStoreNames.contains('cached_jobs')) {
        const jobsStore = database.createObjectStore('cached_jobs', { keyPath: 'id' });
        jobsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Store for cached clients
      if (!database.objectStoreNames.contains('cached_clients')) {
        const clientsStore = database.createObjectStore('cached_clients', { keyPath: 'id' });
        clientsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Store for cached checklists
      if (!database.objectStoreNames.contains('cached_checklists')) {
        const checklistsStore = database.createObjectStore('cached_checklists', { keyPath: 'jobId' });
        checklistsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Store for offline metadata (last sync time, user preferences, etc.)
      if (!database.objectStoreNames.contains('offline_metadata')) {
        database.createObjectStore('offline_metadata', { keyPath: 'key' });
      }
    };
  });
}

// Sync Queue Operations
export async function addToSyncQueue(operation: Omit<QueuedOperation, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
  const database = await initOfflineDb();
  const id = crypto.randomUUID();
  
  const queuedOp: QueuedOperation = {
    ...operation,
    id,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const request = store.add(queuedOp);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<QueuedOperation[]> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readonly');
    const store = transaction.objectStore('sync_queue');
    const index = store.index('createdAt');
    const request = index.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateQueueItemRetry(id: string, retryCount: number): Promise<void> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.retryCount = retryCount;
        store.put(item);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function clearSyncQueue(): Promise<void> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Cached Jobs Operations
export async function cacheJob(job: Record<string, any>): Promise<void> {
  const database = await initOfflineDb();

  const cachedJob: CachedJob = {
    id: job.id,
    data: job,
    cachedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_jobs'], 'readwrite');
    const store = transaction.objectStore('cached_jobs');
    const request = store.put(cachedJob);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedJob(id: string): Promise<CachedJob | null> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_jobs'], 'readonly');
    const store = transaction.objectStore('cached_jobs');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedJobs(): Promise<CachedJob[]> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_jobs'], 'readonly');
    const store = transaction.objectStore('cached_jobs');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOldCachedJobs(maxAgeDays: number = 7): Promise<void> {
  const database = await initOfflineDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_jobs'], 'readwrite');
    const store = transaction.objectStore('cached_jobs');
    const index = store.index('cachedAt');
    const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Cached Clients Operations
export async function cacheClient(client: Record<string, any>): Promise<void> {
  const database = await initOfflineDb();

  const cachedClient: CachedClient = {
    id: client.id,
    data: client,
    cachedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_clients'], 'readwrite');
    const store = transaction.objectStore('cached_clients');
    const request = store.put(cachedClient);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedClient(id: string): Promise<CachedClient | null> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_clients'], 'readonly');
    const store = transaction.objectStore('cached_clients');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedClients(): Promise<CachedClient[]> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_clients'], 'readonly');
    const store = transaction.objectStore('cached_clients');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Cached Checklists Operations
export async function cacheChecklist(jobId: string, items: Record<string, any>[]): Promise<void> {
  const database = await initOfflineDb();

  const cachedChecklist: CachedChecklist = {
    jobId,
    items,
    cachedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_checklists'], 'readwrite');
    const store = transaction.objectStore('cached_checklists');
    const request = store.put(cachedChecklist);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedChecklist(jobId: string): Promise<CachedChecklist | null> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_checklists'], 'readonly');
    const store = transaction.objectStore('cached_checklists');
    const request = store.get(jobId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Offline Metadata Operations
export async function setOfflineMetadata(key: string, value: any): Promise<void> {
  const database = await initOfflineDb();

  const metadata: OfflineMetadata = {
    key,
    value,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['offline_metadata'], 'readwrite');
    const store = transaction.objectStore('offline_metadata');
    const request = store.put(metadata);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineMetadata(key: string): Promise<any> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['offline_metadata'], 'readonly');
    const store = transaction.objectStore('offline_metadata');
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

// Bulk caching for initial data load
export async function cacheJobsWithClients(jobs: Record<string, any>[]): Promise<void> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_jobs', 'cached_clients'], 'readwrite');
    const jobsStore = transaction.objectStore('cached_jobs');
    const clientsStore = transaction.objectStore('cached_clients');
    const now = new Date().toISOString();

    for (const job of jobs) {
      // Cache the job
      jobsStore.put({
        id: job.id,
        data: job,
        cachedAt: now,
      });

      // Cache the client if present
      if (job.client && job.client.id) {
        clientsStore.put({
          id: job.client.id,
          data: job.client,
          cachedAt: now,
        });
      }
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Get offline stats for display
export async function getOfflineStats(): Promise<{
  cachedJobsCount: number;
  cachedClientsCount: number;
  pendingOpsCount: number;
  lastCacheTime: string | null;
}> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cached_jobs', 'cached_clients', 'sync_queue', 'offline_metadata'], 'readonly');
    
    const jobsRequest = transaction.objectStore('cached_jobs').count();
    const clientsRequest = transaction.objectStore('cached_clients').count();
    const queueRequest = transaction.objectStore('sync_queue').count();
    const metaRequest = transaction.objectStore('offline_metadata').get('lastCacheTime');

    let jobsCount = 0;
    let clientsCount = 0;
    let queueCount = 0;
    let lastCacheTime: string | null = null;

    jobsRequest.onsuccess = () => { jobsCount = jobsRequest.result; };
    clientsRequest.onsuccess = () => { clientsCount = clientsRequest.result; };
    queueRequest.onsuccess = () => { queueCount = queueRequest.result; };
    metaRequest.onsuccess = () => { lastCacheTime = metaRequest.result?.value || null; };

    transaction.oncomplete = () => {
      resolve({
        cachedJobsCount: jobsCount,
        cachedClientsCount: clientsCount,
        pendingOpsCount: queueCount,
        lastCacheTime,
      });
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

// Clear all offline data
export async function clearAllOfflineData(): Promise<void> {
  const database = await initOfflineDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ['cached_jobs', 'cached_clients', 'cached_checklists', 'sync_queue', 'offline_metadata'],
      'readwrite'
    );

    transaction.objectStore('cached_jobs').clear();
    transaction.objectStore('cached_clients').clear();
    transaction.objectStore('cached_checklists').clear();
    transaction.objectStore('sync_queue').clear();
    transaction.objectStore('offline_metadata').clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
