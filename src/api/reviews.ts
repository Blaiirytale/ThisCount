// Reviews: stars, worked/didn't, text, photo, helpful, report, replies

import { requireSupabase, supabase } from '../lib/supabase';
import { resizeImage } from '../utils/image';
import type { ReportReason, Review, ReviewReply, ReviewSort, ReviewStats } from '../types';

const BUCKET = 'review-photos';

// ---------- Error helpers ----------

// The database says "blocked_language" when the bad-word filter catches something
export function isBlockedLanguage(err: unknown): boolean {
  return String((err as { message?: string })?.message ?? '').includes('blocked_language');
}

// "duplicate key" = already done (e.g. already reported)
export function isDuplicate(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

// ---------- Card summaries ----------

interface StatsRow {
  deal_id: string;
  review_count: number;
  avg_rating: number;
  worked: number;
  didnt: number;
  latest_body: string | null;
  latest_adj: string | null;
  latest_animal: string | null;
  latest_tag: string | null;
}

export async function loadReviewStats(): Promise<Record<string, ReviewStats>> {
  if (!supabase) return {};
  const { data, error } = await supabase.rpc('get_review_stats');
  if (error) throw error;
  return Object.fromEntries(
    (data as StatsRow[]).map((r) => [
      r.deal_id,
      {
        count: r.review_count,
        avgRating: Number(r.avg_rating),
        worked: r.worked,
        didnt: r.didnt,
        latest: r.latest_body
          ? { body: r.latest_body, author: { adj: r.latest_adj ?? '', animal: r.latest_animal ?? '', tag: r.latest_tag ?? '' } }
          : null,
      },
    ]),
  );
}

// ---------- Reading reviews ----------

interface ReplyRow {
  id: number;
  body: string;
  author_role: 'owner' | 'admin';
  author_label: string;
  created_at: string;
}

interface ReviewRow {
  id: number;
  user_id: string;
  rating: number;
  worked: boolean | null;
  body: string;
  photo_path: string | null;
  author_adj: string;
  author_animal: string;
  author_tag: string;
  helpful_count: number;
  status: 'visible' | 'hidden';
  created_at: string;
  review_replies: ReplyRow[];
}

const COLUMNS =
  'id, user_id, rating, worked, body, photo_path, author_adj, author_animal, author_tag, helpful_count, status, created_at, ' +
  'review_replies (id, body, author_role, author_label, created_at)';

function photoUrl(path: string | null): string | null {
  if (!path || !supabase) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function fromReplyRow(r: ReplyRow): ReviewReply {
  return { id: r.id, body: r.body, authorRole: r.author_role, authorLabel: r.author_label, createdAt: r.created_at };
}

function fromRow(r: ReviewRow, userId: string | null): Review {
  return {
    id: r.id,
    rating: r.rating,
    worked: r.worked,
    body: r.body,
    photoPath: r.photo_path,
    photoUrl: photoUrl(r.photo_path),
    author: { adj: r.author_adj, animal: r.author_animal, tag: r.author_tag },
    helpfulCount: r.helpful_count,
    createdAt: r.created_at,
    authorId: r.user_id,
    isMine: r.user_id === userId,
    isHidden: r.status === 'hidden',
    replies: (r.review_replies ?? []).map(fromReplyRow).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function listReviews(dealId: string, userId: string | null, sort: ReviewSort): Promise<Review[]> {
  if (!supabase) return [];
  let query = supabase.from('reviews').select(COLUMNS).eq('deal_id', dealId);
  query =
    sort === 'helpful'
      ? query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false })
      : query.order('created_at', { ascending: false });
  const { data, error } = await query.limit(50);
  if (error) throw error;
  return (data as unknown as ReviewRow[]).map((r) => fromRow(r, userId));
}

// Which of these reviews I already marked helpful
export async function loadMyHelpful(reviewIds: number[]): Promise<Set<number>> {
  if (reviewIds.length === 0) return new Set();
  const { data, error } = await requireSupabase().from('review_helpful').select('review_id').in('review_id', reviewIds);
  if (error) throw error;
  return new Set((data as { review_id: number }[]).map((r) => r.review_id));
}

// ---------- Writing ----------

export interface NewReview {
  dealId: string;
  rating: number;
  worked: boolean | null;
  body: string;
  photo: File | null;
}

// Uploads the photo (made smaller first), then saves the review.
// The animal name and counters are filled in by the database.
export async function postReview(input: NewReview, userId: string): Promise<void> {
  const sb = requireSupabase();
  let photoPath: string | null = null;

  if (input.photo) {
    const blob = await resizeImage(input.photo);
    photoPath = `${userId}/${input.dealId}-${Date.now()}.jpg`; // must start with your user id
    const upload = await sb.storage.from(BUCKET).upload(photoPath, blob, { contentType: 'image/jpeg' });
    if (upload.error) throw upload.error;
  }

  const { error } = await sb.from('reviews').insert({
    deal_id: input.dealId,
    user_id: userId,
    rating: input.rating,
    worked: input.worked,
    body: input.body.trim(),
    photo_path: photoPath,
  });
  if (error) {
    // Don't leave an unused photo behind
    if (photoPath) await sb.storage.from(BUCKET).remove([photoPath]);
    throw error;
  }
}

export async function deleteReview(review: { id: number; photoPath: string | null }): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('reviews').delete().eq('id', review.id);
  if (error) throw error;
  if (review.photoPath) await sb.storage.from(BUCKET).remove([review.photoPath]);
}

export function reviewPhotoUrl(path: string | null): string | null {
  return photoUrl(path);
}

export async function setHelpful(reviewId: number, userId: string, helpful: boolean): Promise<void> {
  const table = requireSupabase().from('review_helpful');
  const { error } = helpful
    ? await table.insert({ review_id: reviewId, user_id: userId })
    : await table.delete().eq('review_id', reviewId).eq('user_id', userId);
  if (error && !isDuplicate(error)) throw error;
}

export async function reportReview(reviewId: number, userId: string, reason: ReportReason): Promise<void> {
  const { error } = await requireSupabase()
    .from('review_reports')
    .insert({ review_id: reviewId, user_id: userId, reason });
  if (error && !isDuplicate(error)) throw error; // reporting twice is fine
}

// Only the deal's approved owner or an admin can reply (checked by the database)
export async function postReply(reviewId: number, userId: string, body: string): Promise<ReviewReply> {
  const { data, error } = await requireSupabase()
    .from('review_replies')
    .insert({ review_id: reviewId, user_id: userId, body: body.trim() })
    .select('id, body, author_role, author_label, created_at')
    .single();
  if (error) throw error;
  return fromReplyRow(data as ReplyRow);
}
