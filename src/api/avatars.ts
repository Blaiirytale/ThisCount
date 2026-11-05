// Profile pictures. Files live in the "avatars" bucket under <user id>/.

import { requireSupabase, supabase } from '../lib/supabase';
import { resizeImage } from '../utils/image';

const BUCKET = 'avatars';

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path || !supabase) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Upload a new picture, switch to it, then delete the old file
export async function uploadMyAvatar(file: File, userId: string): Promise<void> {
  const sb = requireSupabase();
  const blob = await resizeImage(file, 512); // small is enough for a round picture
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const upload = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (upload.error) throw upload.error;
  const { data: oldPath, error } = await sb.rpc('set_my_avatar', { p_path: path });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw error;
  }
  if (oldPath) await sb.storage.from(BUCKET).remove([oldPath as string]);
}

export async function removeMyAvatar(): Promise<void> {
  const sb = requireSupabase();
  const { data: oldPath, error } = await sb.rpc('set_my_avatar', { p_path: null });
  if (error) throw error;
  if (oldPath) await sb.storage.from(BUCKET).remove([oldPath as string]);
}

// Admins only (the database checks)
export async function adminRemoveAvatar(userId: string): Promise<void> {
  const sb = requireSupabase();
  const { data: oldPath, error } = await sb.rpc('admin_remove_avatar', { p_user: userId });
  if (error) throw error;
  if (oldPath) await sb.storage.from(BUCKET).remove([oldPath as string]);
}

// Pictures for many users at once: { userId: url }
export async function loadAvatars(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)];
  if (!supabase || ids.length === 0) return {};
  const { data, error } = await supabase.rpc('get_avatars', { p_ids: ids });
  if (error) throw error;
  return Object.fromEntries(
    (data as { user_id: string; avatar_path: string }[]).map((r) => [r.user_id, avatarUrl(r.avatar_path) ?? '']),
  );
}
