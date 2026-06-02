import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '@/types';

export async function findAllByUser(client: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await client
    .from('books')
    .select('*, categories(id, name, color)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function findById(
  client: SupabaseClient,
  bookId: string,
  userId: string
): Promise<Book | null> {
  const { data, error } = await client
    .from('books')
    .select('*, categories(id, name, color)')
    .eq('id', bookId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function create(
  client: SupabaseClient,
  bookData: Record<string, unknown>
): Promise<Book> {
  const { data, error } = await client
    .from('books')
    .insert(bookData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function update(
  client: SupabaseClient,
  bookId: string,
  userId: string,
  updates: Record<string, unknown>
): Promise<Book> {
  const { data, error } = await client
    .from('books')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', bookId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function remove(
  client: SupabaseClient,
  bookId: string,
  userId: string
): Promise<void> {
  const { error } = await client
    .from('books')
    .delete()
    .eq('id', bookId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function findEvictionCandidates(
  adminClient: SupabaseClient,
  days: number
): Promise<{ id: string; user_id: string; cloudinary_public_id: string | null }[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await adminClient
    .from('books')
    .select('id, user_id, cloudinary_public_id')
    .eq('pdf_status', 'active')
    .lt('last_opened_at', cutoff.toISOString());

  if (error) throw error;
  return data;
}

export async function markAsEvicted(
  adminClient: SupabaseClient,
  bookIds: string[]
): Promise<void> {
  const { error } = await adminClient
    .from('books')
    .update({
      pdf_status: 'evicted',
      cloudinary_public_id: null,
      pdf_url: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', bookIds);

  if (error) throw error;
}
