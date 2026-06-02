import { openDB } from 'idb';
import type { CachedPDF } from '@/types';

const DB_NAME = 'readstack-cache';
const DB_VERSION = 1;
const STORE = 'pdf-cache';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'bookId' });
      }
    },
  });
}

export async function cachePDF(
  bookId: string,
  arrayBuffer: ArrayBuffer,
  totalPages: number
): Promise<void> {
  const db = await getDB();
  await db.put(STORE, { bookId, arrayBuffer, totalPages, cachedAt: Date.now() });
}

export async function getCachedPDF(bookId: string): Promise<CachedPDF | null> {
  try {
    const db = await getDB();
    const entry = await db.get(STORE, bookId);
    return entry ?? null;
  } catch {
    return null;
  }
}

export async function isPDFCached(bookId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const entry = await db.get(STORE, bookId);
    return !!entry;
  } catch {
    return false;
  }
}

export async function evictCachedPDF(bookId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE, bookId);
  } catch {
    // Non-critical — ignore if not cached
  }
}
