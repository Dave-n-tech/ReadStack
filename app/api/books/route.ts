import { createClient } from '@/lib/supabase/server';
import { BooksRepository } from '@/lib/db/index';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const books = await BooksRepository.findAllByUser(supabase, user.id);
    return NextResponse.json(books);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, author, categoryId, cloudinaryPublicId, pdfUrl, totalPages } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const book = await BooksRepository.create(supabase, {
      user_id: user.id,
      title: title.trim(),
      author: author?.trim() ?? null,
      category_id: categoryId ?? null,
      cloudinary_public_id: cloudinaryPublicId ?? null,
      pdf_url: pdfUrl ?? null,
      total_pages: totalPages ?? null,
      pdf_status: pdfUrl ? 'active' : 'evicted',
      current_page: 1,
      uploaded_at: pdfUrl ? new Date().toISOString() : null,
      last_opened_at: null,
    });

    return NextResponse.json(book, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
