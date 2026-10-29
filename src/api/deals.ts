// Loads deals: from the database if connected, otherwise from public/data/deals.json.

import { supabase } from '../lib/supabase';
import type { Category, Deal } from '../types';

// How a row looks in the "deals" table
export interface DealRow {
  id: string;
  category: Category;
  area: string;
  name_zh: string;
  name_en: string;
  offer_zh: string;
  offer_en: string;
  conditions_zh: string;
  conditions_en: string;
  map_query: string;
  last_checked: string;
  added_at: string;
  valid_until: string | null;
  owner_id: string | null;
}

export function fromRow(r: DealRow): Deal {
  return {
    id: r.id,
    category: r.category,
    area: r.area,
    name: { zh: r.name_zh, en: r.name_en },
    offer: { zh: r.offer_zh, en: r.offer_en },
    conditions: { zh: r.conditions_zh, en: r.conditions_en },
    mapQuery: r.map_query,
    lastChecked: r.last_checked,
    addedAt: r.added_at,
    validUntil: r.valid_until,
    ownerId: r.owner_id,
  };
}

export async function loadDeals(): Promise<Deal[]> {
  let deals: Deal[];
  if (supabase) {
    const { data, error } = await supabase.from('deals').select('*').eq('is_active', true);
    if (error) throw error;
    deals = (data as DealRow[]).map(fromRow);
  } else {
    const res = await fetch(`${import.meta.env.BASE_URL}data/deals.json`);
    if (!res.ok) throw new Error(`Could not load deals (HTTP ${res.status})`);
    deals = (await res.json()) as Deal[];
  }
  // Expired deals disappear automatically (admins still see them in the admin page)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()); // YYYY-MM-DD
  deals = deals.filter((d) => !d.validUntil || d.validUntil >= today);
  // Newest first
  return deals.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
