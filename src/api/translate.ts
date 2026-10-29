// Asks our "translate-review" server function to translate a review.

import { requireSupabase, supabase } from '../lib/supabase';
import type { Lang } from '../types';

export const translationAvailable = supabase !== null;

// Quick guess: Chinese characters = Chinese, otherwise English.
// Used to hide the Translate button when the review is already in your language.
export function looksLike(text: string): Lang {
  const chinese = (text.match(/[一-鿿]/g) ?? []).length;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  return chinese * 2 >= latin ? 'zh' : 'en';
}

export class QuotaError extends Error {}

export async function translateReview(reviewId: number, target: Lang): Promise<string> {
  const { data, error } = await requireSupabase().functions.invoke('translate-review', {
    body: { reviewId, target },
  });
  if (error) {
    // 429 = the free monthly DeepL limit is used up
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new QuotaError('quota');
    throw error;
  }
  return (data as { text: string }).text;
}
