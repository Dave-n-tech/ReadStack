import { openDB } from 'idb';
import type { SyncQueueItem } from '@/types';

const DB_NAME = 'readstack-sync';
const DB_VERSION = 1;
const STORE = 'sync-queue';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

export async function enqueueProgressUpdate(
  bookId: string,
  currentPage: number
): Promise<void> {
  const db = await getDB();

  const all = await db.getAll(STORE);
  const existing = all.find(
    (item: SyncQueueItem) => item.type === 'progress' && item.payload.bookId === bookId
  );
  if (existing) {
    await db.put(STORE, {
      ...existing,
      payload: { bookId, currentPage },
      timestamp: Date.now(),
    });
  } else {
    await db.add(STORE, {
      type: 'progress',
      payload: { bookId, currentPage },
      timestamp: Date.now(),
      retries: 0,
    });
  }
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE, 'timestamp');
}

export async function removeItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function incrementRetries(id: number): Promise<void> {
  const MAX_RETRIES = 5;
  const db = await getDB();
  const item: SyncQueueItem | undefined = await db.get(STORE, id);
  if (!item) return;

  if (item.retries >= MAX_RETRIES) {
    await db.delete(STORE, id);
  } else {
    await db.put(STORE, { ...item, retries: item.retries + 1 });
  }
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}
