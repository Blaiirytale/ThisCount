// Which users are admins (shared by all reviews, loaded once)

import { useEffect, useState } from 'react';
import { loadAdminIds } from '../api/profile';

export function useAdminIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    loadAdminIds()
      .then(setIds)
      .catch((err) => console.error('[ThisCount] admin ids', err));
  }, []);
  return ids;
}
