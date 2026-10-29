// Reviews inside the deal pop-up: summary, write a review, list

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { animalLabel } from '../i18n/animals';
import {
  deleteReview,
  isBlockedLanguage,
  listReviews,
  loadMyHelpful,
  postReply,
  postReview,
  reportReview,
  setHelpful,
} from '../api/reviews';
import { checkPhoto, MAX_PHOTO_MB } from '../utils/image';
import { Stars, StarInput } from './Stars';
import { ReviewItem } from './ReviewItem';
import type { Deal, Profile, Review, ReviewSort, ReviewStats } from '../types';

const MAX_LENGTH = 500; // same limit as the database

interface Props {
  deal: Deal;
  stats?: ReviewStats;
  userId: string | null;
  profile: Profile | null;
  onLogin: () => void;
  onChanged: () => void; // tell the page to refresh card summaries
}

export function ReviewSection({ deal, stats, userId, profile, onLogin, onChanged }: Props) {
  const { t, lang } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sort, setSort] = useState<ReviewSort>('helpful');
  const [myHelpful, setMyHelpful] = useState<Set<number>>(new Set());

  // Form
  const [rating, setRating] = useState(0);
  const [worked, setWorked] = useState<boolean | null>(null);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const canReply = !!profile && (profile.isAdmin || (!!deal.ownerId && deal.ownerId === userId));
  const myReview = reviews.find((r) => r.isMine);

  const refresh = useCallback(async () => {
    try {
      const list = await listReviews(deal.id, userId, sort);
      setReviews(list);
      setStatus('ready');
      if (userId) setMyHelpful(await loadMyHelpful(list.map((r) => r.id)));
    } catch (err) {
      console.error('[ThisCount] reviews', err);
      setStatus('error');
    }
  }, [deal.id, userId, sort]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Free the preview image memory when it changes
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets you pick the same file again
    if (!file) return;
    const problem = checkPhoto(file);
    if (problem) {
      setError(problem === 'type' ? t('photoType') : t('photoTooBig').replace('{mb}', String(MAX_PHOTO_MB)));
      return;
    }
    setError('');
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhoto(null);
    setPreview(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return onLogin();
    if (rating === 0) return setError(t('ratingRequired'));
    setSending(true);
    setError('');
    try {
      await postReview({ dealId: deal.id, rating, worked, body, photo }, userId);
      setRating(0);
      setWorked(null);
      setBody('');
      clearPhoto();
      await refresh();
      onChanged();
    } catch (err) {
      console.error('[ThisCount] postReview', err);
      setError(isBlockedLanguage(err) ? t('blockedLanguage') : t('actionError'));
    } finally {
      setSending(false);
    }
  }

  async function handleHelpful(review: Review) {
    if (!userId) return onLogin();
    const on = !myHelpful.has(review.id);
    // Update the screen first, then save
    setMyHelpful((s) => {
      const next = new Set(s);
      if (on) next.add(review.id);
      else next.delete(review.id);
      return next;
    });
    setReviews((list) =>
      list.map((r) => (r.id === review.id ? { ...r, helpfulCount: r.helpfulCount + (on ? 1 : -1) } : r)),
    );
    try {
      await setHelpful(review.id, userId, on);
    } catch (err) {
      console.error('[ThisCount] helpful', err);
      refresh();
    }
  }

  async function handleDelete(review: Review) {
    try {
      await deleteReview(review);
      await refresh();
      onChanged();
    } catch (err) {
      console.error('[ThisCount] deleteReview', err);
      setError(t('actionError'));
    }
  }

  async function handleReply(review: Review, text: string) {
    if (!userId) return onLogin();
    const reply = await postReply(review.id, userId, text);
    setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, replies: [...r.replies, reply] } : r)));
  }

  const toggleWorked = (value: boolean) => setWorked((w) => (w === value ? null : value));

  return (
    <section className="reviews" aria-labelledby="reviews-title">
      {/* Summary */}
      <div className="review-summary">
        <h3 id="reviews-title" className="section-title">
          {t('reviews')}
        </h3>
        {stats && stats.count > 0 ? (
          <div className="summary-line">
            <Stars value={stats.avgRating} />
            <strong>{stats.avgRating.toFixed(1)}</strong>
            <span className="muted">
              ({stats.count} {t('reviewCount')})
            </span>
            <span className="tag tag-good">✓ {stats.worked} {t('worked')}</span>
            <span className="tag tag-bad">✕ {stats.didnt} {t('didnt')}</span>
          </div>
        ) : (
          <p className="muted">{t('noReviewsYet')}</p>
        )}
      </div>

      {/* Write a review */}
      {!userId ? (
        <button type="button" className="btn-ghost" onClick={onLogin}>
          {t('loginToReview')}
        </button>
      ) : myReview ? (
        <p className="muted small">{t('alreadyReviewed')}</p>
      ) : (
        <form className="review-form" onSubmit={handleSubmit} noValidate>
          {profile && (
            <p className="small muted">
              {t('postingAs')} <strong>{animalLabel(profile.animal, lang)}</strong>
            </p>
          )}
          <StarInput value={rating} onChange={setRating} label={t('yourRating')} />
          <div className="chips">
            <button type="button" className="chip" aria-pressed={worked === true} onClick={() => toggleWorked(true)}>
              ✓ {t('worked')}
            </button>
            <button type="button" className="chip" aria-pressed={worked === false} onClick={() => toggleWorked(false)}>
              ✕ {t('didnt')}
            </button>
          </div>
          <textarea
            id="review-body"
            className="field"
            rows={3}
            maxLength={MAX_LENGTH}
            placeholder={t('reviewPlaceholder')}
            aria-label={t('reviews')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="photo-row">
            {preview ? (
              <>
                <img src={preview} alt="" className="photo-preview" />
                <button type="button" className="link-btn" onClick={clearPhoto}>
                  {t('removePhoto')}
                </button>
              </>
            ) : (
              <label className="btn-ghost" htmlFor="review-photo">
                📷 {t('addPhoto')}
                <input id="review-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickPhoto} />
              </label>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? t('sending') : t('postReview')}
          </button>
          {error && <p className="form-message" data-kind="error">{error}</p>}
        </form>
      )}

      {/* Sort + list */}
      {reviews.length > 1 && (
        <div className="chips sort-chips" role="group" aria-label="Sort">
          <button type="button" className="chip" aria-pressed={sort === 'helpful'} onClick={() => setSort('helpful')}>
            {t('sortHelpful')}
          </button>
          <button type="button" className="chip" aria-pressed={sort === 'newest'} onClick={() => setSort('newest')}>
            {t('sortNewest')}
          </button>
        </div>
      )}
      {status === 'error' && <p className="muted">{t('reviewsError')}</p>}
      <ul className="review-list">
        {reviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            isHelpful={myHelpful.has(review.id)}
            canReply={canReply}
            onHelpful={() => handleHelpful(review)}
            onReport={async (reason) => {
              if (!userId) return onLogin();
              try {
                await reportReview(review.id, userId, reason);
              } catch (err) {
                console.error('[ThisCount] report', err);
              }
            }}
            onDelete={() => handleDelete(review)}
            onReply={(text) => handleReply(review, text)}
          />
        ))}
      </ul>
    </section>
  );
}
