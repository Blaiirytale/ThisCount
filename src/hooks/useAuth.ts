// Login state. Email + password (Supabase stores passwords safely, hashed).

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { requireSupabase, supabase } from '../lib/supabase';

export function useAuth(): { user: User | null } {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // Already logged in?
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    // Listen for log in / log out
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { user };
}

export type AuthProblem = 'wrongPassword' | 'alreadyRegistered' | 'weakPassword' | 'confirmEmail' | 'tooMany' | 'other';

// Turns Supabase's error into something we can explain to the user
function problemFrom(err: { message?: string; code?: string; status?: number }): AuthProblem {
  const msg = (err.message ?? '').toLowerCase();
  if (err.code === 'invalid_credentials' || msg.includes('invalid login')) return 'wrongPassword';
  if (err.code === 'user_already_exists' || msg.includes('already registered')) return 'alreadyRegistered';
  if (err.code === 'weak_password' || msg.includes('password should')) return 'weakPassword';
  if (err.code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'confirmEmail';
  if (err.status === 429) return 'tooMany';
  return 'other';
}

export class AuthError extends Error {
  constructor(public problem: AuthProblem) {
    super(problem);
  }
}

export async function logIn(email: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new AuthError(problemFrom(error));
}

// Returns true if the user is logged in right away,
// false if Supabase still wants them to confirm their email first.
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await requireSupabase().auth.signUp({ email, password });
  if (error) throw new AuthError(problemFrom(error));
  // Supabase hides "already registered" by returning a user with no identities
  if (data.user && data.user.identities?.length === 0) throw new AuthError('alreadyRegistered');
  return data.session !== null;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
