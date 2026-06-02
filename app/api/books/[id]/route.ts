import { createClient } from '@/lib/supabase/server';
import { BooksRepository } from '@/lib/db/index';
import { deleteFile } from '@/lib/cloudinary';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, props: RouteProps) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const book = await BooksRepository.findById(supabase, params.id, user.id);
    if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(book);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: RouteProps) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const allowed = [
      'title', 'author', 'category_id', 'cloudinary_public_id',
      'pdf_url', 'total_pages', 'pdf_status', 'uploaded_at',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const book = await BooksRepository.update(supabase, params.id, user.id, updates);
    return NextResponse.json(book);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: RouteProps) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const book = await BooksRepository.findById(supabase, params.id, user.id);
    if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (book.cloudinary_public_id) {
      try {
        await deleteFile(book.cloudinary_public_id);
      } catch (err) {
        console.error('Cloudinary delete failed:', err);
      }
    }

    await BooksRepository.remove(supabase, params.id, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
