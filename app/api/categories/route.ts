import { createClient } from '@/lib/supabase/server';
import { CategoriesRepository } from '@/lib/db/index';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const categories = await CategoriesRepository.findAllByUser(supabase, user.id);
    return NextResponse.json(categories);
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
    const { name, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const position = await CategoriesRepository.getMaxPosition(supabase, user.id);
    const category = await CategoriesRepository.create(supabase, {
      user_id: user.id,
      name: name.trim(),
      color: color ?? '#6EBF8B',
      position,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
