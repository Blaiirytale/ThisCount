// The logged-in user's profile: animal name, owner status, admin status

import { requireSupabase } from '../lib/supabase';
import type { Profile } from '../types';

export async function loadProfile(): Promise<Profile | null> {
  const sb = requireSupabase();
  // Makes sure the user has an animal name (creates one if missing)
  const ensured = await sb.rpc('ensure_my_profile');
  if (ensured.error) throw ensured.error;

  const [profile, admin] = await Promise.all([
    sb.from('profiles').select('adj, animal, tag, role, shop_name').maybeSingle(),
    sb.rpc('is_admin'),
  ]);
  if (profile.error) throw profile.error;
  if (!profile.data) return null;

  const p = profile.data as { adj: string; animal: string; tag: string; role: 'student' | 'owner'; shop_name: string | null };
  return {
    animal: { adj: p.adj, animal: p.animal, tag: p.tag },
    role: p.role,
    shopName: p.shop_name,
    isAdmin: admin.data === true,
  };
}
