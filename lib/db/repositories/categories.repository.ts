import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '@/types';

export async function findAllByUser(
  client: SupabaseClient,
  userId: string
): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data;
}

export async function create(
  client: SupabaseClient,
  categoryData: Record<string, unknown>
): Promise<Category> {
  const { data, error } = await client
    .from('categories')
    .insert(categoryData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function update(
  client: SupabaseClient,
  categoryId: string,
  userId: string,
  updates: Record<string, unknown>
): Promise<Category> {
  const { data, error } = await client
    .from('categories')
    .update(updates)
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function remove(
  client: SupabaseClient,
  categoryId: string,
  userId: string
): Promise<void> {
  const { error } = await client
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getMaxPosition(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await client
    .from('categories')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  if (error) return 0;
  return (data?.position ?? -1) + 1;
}
