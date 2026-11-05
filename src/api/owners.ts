// Shop owners: applying, and seeing your application status.

import { requireSupabase } from '../lib/supabase';
import type { Category } from '../types';

export interface OwnerApplicationInput {
  shopName: string;
  contact: string;          // phone or LINE ID
  area: string;             // e.g. 大學城
  category: Category | null;
  offer: string;            // the student discount they want to offer
  dealId: string | null;    // which listed deal is theirs (null = not listed yet)
  message: string;
}

export interface MyApplication {
  id: number;
  shopName: string;
  offer: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// The database answers "already_pending" if you already have one waiting
export function isAlreadyPending(err: unknown): boolean {
  return String((err as { message?: string })?.message ?? '').includes('already_pending');
}

export async function applyAsOwner(app: OwnerApplicationInput, userId: string): Promise<void> {
  const { error } = await requireSupabase().from('owner_applications').insert({
    user_id: userId,
    shop_name: app.shopName.trim(),
    contact: app.contact.trim(),
    area: app.area.trim(),
    category: app.category,
    offer: app.offer.trim(),
    deal_id: app.dealId,
    message: app.message.trim(),
  });
  if (error) throw error;
}

// My newest application (the database only returns my own)
export async function loadMyApplication(userId: string): Promise<MyApplication | null> {
  const { data, error } = await requireSupabase()
    .from('owner_applications')
    .select('id, shop_name, offer, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as { id: number; shop_name: string; offer: string; status: MyApplication['status']; created_at: string };
  return { id: r.id, shopName: r.shop_name, offer: r.offer, status: r.status, createdAt: r.created_at };
}
