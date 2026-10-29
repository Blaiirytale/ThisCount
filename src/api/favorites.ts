// Favorite deals (♥), saved per user

import { requireSupabase } from '../lib/supabase';

export async function loadFavorites(): Promise<Set<string>> {
  const { data, error } = await requireSupabase().from('favorites').select('deal_id');
  if (error) throw error;
  return new Set((data as { deal_id: string }[]).map((r) => r.deal_id));
}

export async function addFavorite(dealId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase().from('favorites').insert({ deal_id: dealId, user_id: userId });
  if (error) throw error;
}

export async function removeFavorite(dealId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('favorites')
    .delete()
    .eq('deal_id', dealId)
    .eq('user_id', userId);
  if (error) throw error;
}
