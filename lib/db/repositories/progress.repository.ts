import type { SupabaseClient } from '@supabase/supabase-js';

export async function getProgress(
  client: SupabaseClient,
  bookId: string,
  userId: string
): Promise<{ current_page: number; total_pages: number; last_opened_at: string } | null> {
  const { data, error } = await client
    .from('books')
    .select('current_page, total_pages, last_opened_at')
    .eq('id', bookId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function saveProgress(
  client: SupabaseClient,
  bookId: string,
  userId: string,
  currentPage: number
): Promise<void> {
  const { error } = await client
    .from('books')
    .update({
      current_page: currentPage,
      last_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookId)
    .eq('user_id', userId);

  if (error) throw error;
}
