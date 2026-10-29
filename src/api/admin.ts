// Admin-only database calls. The database checks is_admin() on every one,
// so these fail for normal users even if someone calls them directly.

import { requireSupabase } from '../lib/supabase';
import { fromRow, type DealRow } from './deals';
import type { Bilingual, Category, Deal, ReportReason } from '../types';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

// ---------- Deal submissions (from students) ----------

export interface Submission {
  id: number;
  shop: string;
  category: Category;
  offer: string;
  conditions: string;
  status: ReviewStatus;
  createdAt: string;
}

export async function listSubmissions(status: ReviewStatus): Promise<Submission[]> {
  const { data, error } = await requireSupabase()
    .from('submissions')
    .select('id, shop, category, offer, conditions, status, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    shop: r.shop as string,
    category: r.category as Category,
    offer: r.offer as string,
    conditions: r.conditions as string,
    status: r.status as ReviewStatus,
    createdAt: r.created_at as string,
  }));
}

export async function setSubmissionStatus(id: number, status: ReviewStatus): Promise<void> {
  const { error } = await requireSupabase().from('submissions').update({ status }).eq('id', id);
  if (error) throw error;
}

// ---------- Deals (create, edit, hide) ----------

export interface DealInput {
  category: Category;
  area: string;
  name: Bilingual;
  offer: Bilingual;
  conditions: Bilingual;
  mapQuery: string;
  validUntil: string | null;  // YYYY-MM-DD, empty = no end date
  lastChecked: string;        // YYYY-MM-DD
  isActive: boolean;          // false = hidden from the site
}

export interface AdminDeal extends Deal {
  isActive: boolean;
}

// Database column names for a DealInput
function toRow(input: DealInput) {
  return {
    category: input.category,
    area: input.area.trim(),
    name_zh: input.name.zh.trim(),
    name_en: input.name.en.trim(),
    offer_zh: input.offer.zh.trim(),
    offer_en: input.offer.en.trim(),
    conditions_zh: input.conditions.zh.trim(),
    conditions_en: input.conditions.en.trim(),
    map_query: input.mapQuery.trim(),
    valid_until: input.validUntil || null,
    last_checked: input.lastChecked,
    is_active: input.isActive,
  };
}

// Every deal, including hidden ones (only admins can see hidden ones)
export async function listAllDeals(): Promise<AdminDeal[]> {
  const { data, error } = await requireSupabase()
    .from('deals')
    .select('*')
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data as (DealRow & { is_active: boolean })[]).map((r) => ({ ...fromRow(r), isActive: r.is_active }));
}

// "Sample Bento House" → "sample-bento-house" (the deal's id)
export function makeDealId(englishName: string): string {
  const slug = englishName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || `deal-${Date.now().toString(36)}`;
}

// Creates the deal. If the id is taken, adds a short random ending and tries once more.
export async function createDeal(input: DealInput): Promise<string> {
  const base = makeDealId(input.name.en);
  for (const id of [base, `${base}-${Math.random().toString(36).slice(2, 6)}`]) {
    const { error } = await requireSupabase().from('deals').insert({ id, ...toRow(input) });
    if (!error) return id;
    if (error.code !== '23505') throw error; // 23505 = id already used
  }
  throw new Error('Could not create a unique deal id');
}

export async function updateDeal(id: string, input: DealInput): Promise<void> {
  const { error } = await requireSupabase().from('deals').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

// Quick show/hide without opening the form
export async function setDealActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await requireSupabase().from('deals').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

// ---------- Shop owner applications ----------

export interface OwnerApplication {
  id: number;
  shopName: string;
  contact: string;
  message: string;
  dealId: string | null;
  dealName: Bilingual | null;
  status: ReviewStatus;
  createdAt: string;
}

interface ApplicationRow {
  id: number;
  shop_name: string;
  contact: string;
  message: string;
  deal_id: string | null;
  status: ReviewStatus;
  created_at: string;
  deals: { name_zh: string; name_en: string } | null;
}

export async function listOwnerApplications(status: ReviewStatus): Promise<OwnerApplication[]> {
  const { data, error } = await requireSupabase()
    .from('owner_applications')
    .select('id, shop_name, contact, message, deal_id, status, created_at, deals (name_zh, name_en)')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ApplicationRow[]).map((r) => ({
    id: r.id,
    shopName: r.shop_name,
    contact: r.contact,
    message: r.message,
    dealId: r.deal_id,
    dealName: r.deals ? { zh: r.deals.name_zh, en: r.deals.name_en } : null,
    status: r.status,
    createdAt: r.created_at,
  }));
}

// Approving makes the user an owner and links the deal (done by a database trigger)
export async function decideOwnerApplication(id: number, status: ReviewStatus, dealId: string | null): Promise<void> {
  const { error } = await requireSupabase()
    .from('owner_applications')
    .update({ status, deal_id: dealId })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Reported reviews ----------

export interface ReportedReview {
  id: number;
  dealName: Bilingual | null;
  rating: number;
  body: string;
  photoPath: string | null;
  hidden: boolean;
  reportCount: number;
  reasons: Record<ReportReason, number>;
  createdAt: string;
}

interface ReportedRow {
  id: number;
  rating: number;
  body: string;
  photo_path: string | null;
  status: 'visible' | 'hidden';
  report_count: number;
  created_at: string;
  deals: { name_zh: string; name_en: string } | null;
  review_reports: { reason: ReportReason }[];
}

export async function listReportedReviews(): Promise<ReportedReview[]> {
  const { data, error } = await requireSupabase()
    .from('reviews')
    .select('id, rating, body, photo_path, status, report_count, created_at, deals (name_zh, name_en), review_reports (reason)')
    .gt('report_count', 0)
    .order('report_count', { ascending: false });
  if (error) throw error;
  return (data as unknown as ReportedRow[]).map((r) => {
    const reasons = { spam: 0, rude: 0, wrong: 0, other: 0 } as Record<ReportReason, number>;
    for (const rep of r.review_reports ?? []) reasons[rep.reason] += 1;
    return {
      id: r.id,
      dealName: r.deals ? { zh: r.deals.name_zh, en: r.deals.name_en } : null,
      rating: r.rating,
      body: r.body,
      photoPath: r.photo_path,
      hidden: r.status === 'hidden',
      reportCount: r.report_count,
      reasons,
      createdAt: r.created_at,
    };
  });
}

// Review was fine: show it again and clear its reports
export async function restoreReview(id: number): Promise<void> {
  const sb = requireSupabase();
  const reports = await sb.from('review_reports').delete().eq('review_id', id);
  if (reports.error) throw reports.error;
  const { error } = await sb.from('reviews').update({ status: 'visible', report_count: 0 }).eq('id', id);
  if (error) throw error;
}

export async function deleteReportedReview(review: ReportedReview): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('reviews').delete().eq('id', review.id);
  if (error) throw error;
  if (review.photoPath) await sb.storage.from('review-photos').remove([review.photoPath]);
}
