'use client';

import { useEffect } from 'react';
import { getPendingItems, removeItem, incrementRetries } from '@/lib/cache/sync-queue';

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (navigator.onLine) flushQueue();

    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, []);

  return <>{children}</>;
}

async function flushQueue() {
  let items;
  try {
    items = await getPendingItems();
  } catch {
    return;
  }

  if (!items.length) return;

  for (const item of items) {
    if (item.type === 'progress') {
      try {
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });

        if (res.ok) {
          await removeItem(item.id);
        } else if (res.status === 401) {
          break;
        } else {
          await incrementRetries(item.id);
        }
      } catch {
        await incrementRetries(item.id);
      }
    }
  }
}
