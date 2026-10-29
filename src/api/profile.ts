// Profiles: my profile, public profiles, name, password

import { requireSupabase, supabase } from '../lib/supabase';
import { reviewPhotoUrl } from './reviews';
import type { AnimalName, Profile, PublicProfile, UserReview } from '../types';

export async function loadProfile(userId: string): Promise<Profile | null> {
  const sb = requireSupabase();
  // Makes sure the user has an animal name (creates one if missing)
  const ensured = await sb.rpc('ensure_my_profile');
  if (ensured.error) throw ensured.error;

  const [profile, admin] = await Promise.all([
    // Only my row: admins can read every profile, so we must filter
    sb.from('profiles').select('adj, animal, tag, role, shop_name, name_rerolled').eq('user_id', userId).maybeSingle(),
    sb.rpc('is_admin'),
  ]);
  if (profile.error) throw profile.error;
  if (!profile.data) return null;

  const p = profile.data as {
    adj: string;
    animal: string;
    tag: string;
    role: 'student' | 'owner';
    shop_name: string | null;
    name_rerolled: boolean;
  };
  return {
    animal: { adj: p.adj, animal: p.animal, tag: p.tag },
    nameRerolled: p.name_rerolled,
    role: p.role,
    shopName: p.shop_name,
    isAdmin: admin.data === true,
  };
}

// 🎲 Get a new random name. The database picks it (no rude names) and allows it only once.
export async function rerollMyAnimal(): Promise<AnimalName> {
  const { data, error } = await requireSupabase().rpc('reroll_my_animal');
  if (error) throw error;
  const row = (data as AnimalName[])[0];
  return { adj: row.adj, animal: row.animal, tag: row.tag };
}

// Admin user ids, loaded once and shared (for the "Admin" badge on reviews)
let adminIdsPromise: Promise<Set<string>> | null = null;

export function loadAdminIds(): Promise<Set<string>> {
  if (!supabase) return Promise.resolve(new Set());
  adminIdsPromise ??= Promise.resolve(supabase.rpc('get_admin_ids')).then(({ data, error }) => {
    if (error) {
      adminIdsPromise = null; // try again next time
      throw error;
    }
    return new Set((data as string[]) ?? []);
  });
  return adminIdsPromise;
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Anyone's public info (no email)
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_public_profile', { p_user: userId });
  if (error) throw error;
  const row = (data as Record<string, unknown>[])[0];
  if (!row) return null;
  return {
    animal: { adj: row.adj as string, animal: row.animal as string, tag: row.tag as string },
    role: row.role as 'student' | 'owner',
    shopName: (row.shop_name as string | null) ?? null,
    joinedAt: row.joined_at as string,
    reviewCount: row.review_count as number,
    isAdmin: row.is_admin === true,
  };
}

interface UserReviewRow {
  id: number;
  deal_id: string;
  rating: number;
  worked: boolean | null;
  body: string;
  photo_path: string | null;
  helpful_count: number;
  status: 'visible' | 'hidden';
  created_at: string;
  deals: { name_zh: string; name_en: string } | null;
}

// Someone's reviews. Hidden ones only come back for their own profile (database rule).
export async function listUserReviews(userId: string): Promise<UserReview[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('id, deal_id, rating, worked, body, photo_path, helpful_count, status, created_at, deals (name_zh, name_en)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as unknown as UserReviewRow[]).map((r) => ({
    id: r.id,
    dealId: r.deal_id,
    dealName: r.deals ? { zh: r.deals.name_zh, en: r.deals.name_en } : null,
    rating: r.rating,
    worked: r.worked,
    body: r.body,
    photoPath: r.photo_path,
    photoUrl: reviewPhotoUrl(r.photo_path),
    helpfulCount: r.helpful_count,
    isHidden: r.status === 'hidden',
    createdAt: r.created_at,
  }));
}
