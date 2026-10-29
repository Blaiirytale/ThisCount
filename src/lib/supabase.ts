// Connects to Supabase if .env has the settings.
// If not, `supabase` is null and the site runs read-only (demo mode).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export class BackendMissingError extends Error {
  constructor() {
    super('Supabase is not configured');
  }
}

// Use inside api/ functions that need the database
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new BackendMissingError();
  return supabase;
}
