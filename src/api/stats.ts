// Trending: record views / map clicks / shares, and read the numbers back.

import { supabase } from '../lib/supabase';

export type TrackKind = 'view' | 'map' | 'share';

export interface DealStats {
  views: number;
  mapClicks: number;
  shares: number;
  saves: number;
  reviews: number;
  score: number; // views + 2×map + 2×shares + 3×saves + 5×reviews
}

// Random id for this browser, so one person counts once per day (not linked to them)
function visitorId(): string {
  try {
    let id = localStorage.getItem('visitorId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('visitorId', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// Don't send the same thing twice in one visit
const sent = new Set<string>();

// Fire and forget: tracking must never break the page
export function trackDeal(dealId: string, kind: TrackKind): void {
  if (!supabase) return;
  const key = `${dealId}:${kind}`;
  if (sent.has(key)) return;
  sent.add(key);
  supabase
    .rpc('track_deal', { p_deal_id: dealId, p_kind: kind, p_visitor: visitorId() })
    .then(({ error }) => {
      if (error) console.warn('[ThisCount] track', error.message);
    });
}

interface StatsRow {
  deal_id: string;
  views: number;
  map_clicks: number;
  shares: number;
  saves: number;
  reviews: number;
  score: number;
}

// includeHidden only works for admins (the database checks)
export async function loadDealStats(days = 7, includeHidden = false): Promise<Record<string, DealStats>> {
  if (!supabase) return {};
  const { data, error } = await supabase.rpc('get_deal_stats', { p_days: days, p_all: includeHidden });
  if (error) throw error;
  return Object.fromEntries(
    (data as StatsRow[]).map((r) => [
      r.deal_id,
      { views: r.views, mapClicks: r.map_clicks, shares: r.shares, saves: r.saves, reviews: r.reviews, score: r.score },
    ]),
  );
}
