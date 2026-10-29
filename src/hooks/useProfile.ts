// Loads the profile (animal name, owner, admin) whenever the user logs in

import { useCallback, useEffect, useState } from 'react';
import { loadProfile } from '../api/profile';
import type { Profile } from '../types';

export function useProfile(userId: string | null): { profile: Profile | null; reload: () => void } {
  const [profile, setProfile] = useState<Profile | null>(null);

  const reload = useCallback(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    loadProfile(userId)
      .then(setProfile)
      .catch((err) => console.error('[ThisCount] profile', err));
  }, [userId]);

  useEffect(reload, [reload]);
  return { profile, reload };
}
