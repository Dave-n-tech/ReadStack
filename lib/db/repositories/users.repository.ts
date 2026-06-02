import type { SupabaseClient } from '@supabase/supabase-js';

interface UserRecord {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
}

export async function findById(
  client: SupabaseClient,
  userId: string
): Promise<UserRecord | null> {
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function upsert(
  client: SupabaseClient,
  userData: Record<string, unknown>
): Promise<UserRecord> {
  const { data, error } = await client
    .from('users')
    .upsert(userData, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
