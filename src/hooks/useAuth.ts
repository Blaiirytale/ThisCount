// Login state. Uses email "magic links": no passwords to store or leak.

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { requireSupabase, supabase } from '../lib/supabase';

export function useAuth(): { user: User | null } {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // Already logged in? (also picks up the login from the email link)
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    // Listen for log in / log out
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { user };
}

export async function sendLoginLink(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOtp({
    email,
    // After clicking the link, come back to this site
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
