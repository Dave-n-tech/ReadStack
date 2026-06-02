import { createClient } from '@/lib/supabase/server';
import { CategoriesRepository } from '@/lib/db/index';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type RouteProps = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, props: RouteProps) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, color } = body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;

    const category = await CategoriesRepository.update(
      supabase, params.id, user.id, updates
    );
    return NextResponse.json(category);
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
    await CategoriesRepository.remove(supabase, params.id, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
