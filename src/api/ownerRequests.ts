// Owner discount requests: owners send new discounts or changes, admins approve.

import { requireSupabase } from '../lib/supabase';
import type { Category } from '../types';

export type RequestKind = 'new' | 'update';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface RequestInput {
  kind: RequestKind;
  dealId: string | null; // the deal to change (only for "update")
  category: Category;
  area: string;
  offerZh: string;
  offerEn: string;
  conditionsZh: string;
  conditionsEn: string;
  validUntil: string | null; // YYYY-MM-DD
  note: string;
}

export interface DealRequest extends RequestInput {
  id: number;
  ownerId: string;
  status: RequestStatus;
  adminNote: string;
  resultDealId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface RequestRow {
  id: number;
  owner_id: string;
  deal_id: string | null;
  kind: RequestKind;
  category: Category;
  area: string;
  offer_zh: string;
  offer_en: string;
  conditions_zh: string;
  conditions_en: string;
  valid_until: string | null;
  note: string;
  status: RequestStatus;
  admin_note: string;
  result_deal_id: string | null;
  created_at: string;
  decided_at: string | null;
}

function fromRow(r: RequestRow): DealRequest {
  return {
    id: r.id,
    ownerId: r.owner_id,
    kind: r.kind,
    dealId: r.deal_id,
    category: r.category,
    area: r.area,
    offerZh: r.offer_zh,
    offerEn: r.offer_en,
    conditionsZh: r.conditions_zh,
    conditionsEn: r.conditions_en,
    validUntil: r.valid_until,
    note: r.note,
    status: r.status,
    adminNote: r.admin_note,
    resultDealId: r.result_deal_id,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  };
}

// Error words the database uses
export function requestErrorKey(err: unknown): 'tooManyPending' | 'blockedLanguage' | 'actionError' {
  const msg = String((err as { message?: string })?.message ?? '');
  if (msg.includes('too_many_pending')) return 'tooManyPending';
  if (msg.includes('blocked_language')) return 'blockedLanguage';
  return 'actionError';
}

// ---------- Owners ----------

export async function sendRequest(input: RequestInput, userId: string): Promise<void> {
  const { error } = await requireSupabase().from('owner_deal_requests').insert({
    owner_id: userId,
    kind: input.kind,
    deal_id: input.kind === 'update' ? input.dealId : null,
    category: input.category,
    area: input.area.trim(),
    offer_zh: input.offerZh.trim(),
    offer_en: input.offerEn.trim(),
    conditions_zh: input.conditionsZh.trim(),
    conditions_en: input.conditionsEn.trim(),
    valid_until: input.validUntil || null,
    note: input.note.trim(),
  });
  if (error) throw error;
}

// My requests (the database only returns my own)
export async function listMyRequests(userId: string): Promise<DealRequest[]> {
  const { data, error } = await requireSupabase()
    .from('owner_deal_requests')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as RequestRow[]).map(fromRow);
}

// Only while still pending
export async function cancelRequest(id: number): Promise<void> {
  const { error } = await requireSupabase().from('owner_deal_requests').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Admins ----------

export async function listRequests(status: RequestStatus): Promise<DealRequest[]> {
  const { data, error } = await requireSupabase()
    .from('owner_deal_requests')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: status === 'pending' }); // oldest first = most urgent
  if (error) throw error;
  return (data as RequestRow[]).map(fromRow);
}

export async function decideRequest(
  id: number,
  status: RequestStatus,
  adminNote = '',
  resultDealId: string | null = null,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('owner_deal_requests')
    .update({ status, admin_note: adminNote.trim(), result_deal_id: resultDealId })
    .eq('id', id);
  if (error) throw error;
}
