// Sends a new deal for admins to review. It is NOT live until an admin adds it.

import { requireSupabase } from '../lib/supabase';
import type { Category } from '../types';

export interface NewDeal {
  shop: string;
  category: Category;
  offer: string;
  conditions: string;
}

export async function submitDeal(deal: NewDeal, userId: string): Promise<void> {
  const { error } = await requireSupabase().from('submissions').insert({
    user_id: userId,
    shop: deal.shop.trim(),
    category: deal.category,
    offer: deal.offer.trim(),
    conditions: deal.conditions.trim(),
  });
  if (error) throw error;
}
