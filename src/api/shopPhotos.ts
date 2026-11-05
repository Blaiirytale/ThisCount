// Store photos added by shop owners (up to 6 per deal)

import { requireSupabase, supabase } from '../lib/supabase';
import { resizeImage } from '../utils/image';

const BUCKET = 'shop-photos';
export const MAX_SHOP_PHOTOS = 6;

export interface ShopPhoto {
  id: number;
  dealId: string;
  path: string;
  url: string;
}

function publicUrl(path: string): string {
  return requireSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// All photos, grouped by deal: { "sample-bento": [photo, photo] }
export async function loadShopPhotos(): Promise<Record<string, ShopPhoto[]>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('deal_photos')
    .select('id, deal_id, path')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const byDeal: Record<string, ShopPhoto[]> = {};
  for (const r of data as { id: number; deal_id: string; path: string }[]) {
    (byDeal[r.deal_id] ??= []).push({ id: r.id, dealId: r.deal_id, path: r.path, url: publicUrl(r.path) });
  }
  return byDeal;
}

// Shrinks the photo, uploads it, then saves it. Folder must be <your id>/<deal id>/.
export async function addShopPhoto(dealId: string, file: File, userId: string): Promise<void> {
  const sb = requireSupabase();
  const blob = await resizeImage(file, 1600);
  const path = `${userId}/${dealId}/${Date.now()}.jpg`;
  const upload = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (upload.error) throw upload.error;
  const { error } = await sb.from('deal_photos').insert({ deal_id: dealId, owner_id: userId, path });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]); // don't leave an unused file behind
    throw error;
  }
}

export async function removeShopPhoto(photo: ShopPhoto): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('deal_photos').delete().eq('id', photo.id);
  if (error) throw error;
  await sb.storage.from(BUCKET).remove([photo.path]);
}

export function photoErrorKey(err: unknown): 'tooManyPhotos' | 'actionError' {
  return String((err as { message?: string })?.message ?? '').includes('too_many_photos') ? 'tooManyPhotos' : 'actionError';
}
