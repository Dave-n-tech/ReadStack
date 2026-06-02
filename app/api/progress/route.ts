import { createClient } from '@/lib/supabase/server';
import { ProgressRepository } from '@/lib/db/index';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { bookId, currentPage } = await request.json();

    if (!bookId || typeof currentPage !== 'number') {
      return NextResponse.json(
        { error: 'bookId and currentPage are required' },
        { status: 400 }
      );
    }

    await ProgressRepository.saveProgress(supabase, bookId, user.id, currentPage);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
