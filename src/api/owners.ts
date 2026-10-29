// Shop owner applications. An admin approves them in Supabase.

import { requireSupabase } from '../lib/supabase';

export interface OwnerApplication {
  shopName: string;
  contact: string;       // phone or LINE ID
  dealId: string | null; // which listed deal is theirs (null = not listed yet)
  message: string;
}

export async function applyAsOwner(app: OwnerApplication, userId: string): Promise<void> {
  const { error } = await requireSupabase().from('owner_applications').insert({
    user_id: userId,
    shop_name: app.shopName.trim(),
    contact: app.contact.trim(),
    deal_id: app.dealId,
    message: app.message.trim(),
  });
  if (error) throw error;
}
