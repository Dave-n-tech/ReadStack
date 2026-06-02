import { createAdminClient } from '@/lib/supabase/server';
import { BooksRepository } from '@/lib/db/index';
import { deleteFile } from '@/lib/cloudinary';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EVICTION_DAYS = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const results: { evicted: number; failed: number; errors: { bookId: string; error: string }[] } =
    { evicted: 0, failed: 0, errors: [] };

  try {
    const candidates = await BooksRepository.findEvictionCandidates(adminClient, EVICTION_DAYS);

    if (candidates.length === 0) {
      return NextResponse.json({ message: 'Nothing to evict', ...results });
    }

    const evictedIds: string[] = [];

    await Promise.allSettled(
      candidates.map(async (book) => {
        try {
          if (book.cloudinary_public_id) {
            await deleteFile(book.cloudinary_public_id);
          }
          evictedIds.push(book.id);
          results.evicted++;
        } catch (err) {
          results.failed++;
          results.errors.push({ bookId: book.id, error: (err as Error).message });
        }
      })
    );

    if (evictedIds.length > 0) {
      await BooksRepository.markAsEvicted(adminClient, evictedIds);
    }

    console.log(`[cron/evict] Evicted: ${results.evicted}, Failed: ${results.failed}`);
    return NextResponse.json(results);
  } catch (err) {
    console.error('[cron/evict] Fatal error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
