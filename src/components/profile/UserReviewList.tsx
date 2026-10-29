// A list of one person's reviews (used on both profile pages)

import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { shortDate } from '../../utils/dates';
import { Stars } from '../Stars';
import type { UserReview } from '../../types';

interface Props {
  reviews: UserReview[];
  emptyText: string;
  onOpenDeal: (dealId: string) => void;
  onDelete?: (review: UserReview) => Promise<void>; // only on my own profile
}

export function UserReviewList({ reviews, emptyText, onOpenDeal, onDelete }: Props) {
  const { t, pick } = useLanguage();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  if (reviews.length === 0) return <p className="muted">{emptyText}</p>;

  return (
    <ul className="admin-list">
      {reviews.map((r) => (
        <li key={r.id} className="admin-item">
          <div className="admin-item-head">
            <button type="button" className="card-link" onClick={() => onOpenDeal(r.dealId)}>
              {r.dealName ? pick(r.dealName) : '—'}
            </button>
            <Stars value={r.rating} />
            <span className="muted small">{shortDate(r.createdAt)}</span>
            {r.isHidden && <span className="tag tag-bad">{t('hiddenStatus')}</span>}
          </div>
          {r.worked === true && <span className="tag tag-good">✓ {t('worked')}</span>}
          {r.worked === false && <span className="tag tag-bad">✕ {t('didnt')}</span>}
          {r.body && <p className="review-body">{r.body}</p>}
          {r.photoUrl && (
            <a href={r.photoUrl} target="_blank" rel="noopener" className="review-photo">
              <img src={r.photoUrl} alt={t('photoAlt')} loading="lazy" />
            </a>
          )}
          <div className="row-gap">
            <span className="muted small">
              👍 {r.helpfulCount} {t('helpful')}
            </span>
            {onDelete &&
              (confirmId === r.id ? (
                <>
                  <button type="button" className="btn-danger" onClick={() => onDelete(r).then(() => setConfirmId(null))}>
                    {t('yesDelete')}
                  </button>
                  <button type="button" className="link-btn" onClick={() => setConfirmId(null)}>
                    {t('cancel')}
                  </button>
                </>
              ) : (
                <button type="button" className="link-btn" onClick={() => setConfirmId(r.id)}>
                  {t('deleteReview')}
                </button>
              ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
