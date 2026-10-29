// One deal, styled like a Notes widget. Tap it to open the details.

import type { MouseEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { animalLabel } from '../i18n/animals';
import { isNew } from '../utils/dates';
import { FavoriteButton } from './FavoriteButton';
import { Stars } from './Stars';
import { ChevronLeftIcon, MoreIcon, ShareIcon } from './Icons';
import type { Deal, ReviewStats } from '../types';

interface Props {
  deal: Deal;
  stats?: ReviewStats;
  isFavorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
}

export function DealCard({ deal, stats, isFavorite, onOpen, onToggleFavorite, onShare }: Props) {
  const { t, pick, lang } = useLanguage();

  // Buttons inside the card shouldn't also trigger the card click
  const only = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article className="note-card" onClick={onOpen}>
      <div className="note-bar">
        <span className="note-back">
          <ChevronLeftIcon />
          {t(`cat.${deal.category}`)}
          {isNew(deal.addedAt) && <span className="badge">{t('new')}</span>}
        </span>
        <span className="note-tools">
          <button type="button" className="note-tool" aria-label={t('share')} onClick={only(onShare)}>
            <ShareIcon />
          </button>
          <button type="button" className="note-tool" aria-label={t('moreInfo')} onClick={only(onOpen)}>
            <MoreIcon />
          </button>
        </span>
      </div>

      <h3 className="note-name">
        {/* Real button so keyboard users can open it too */}
        <button type="button" className="card-link" onClick={only(onOpen)}>
          {pick(deal.name)}
        </button>
      </h3>
      <p className="note-offer">{pick(deal.offer)}</p>
      <p className="note-conditions">
        {deal.area} · {pick(deal.conditions)}
      </p>

      {/* Newest written review */}
      {stats?.latest && (
        <p className="note-preview">
          “{stats.latest.body}” <span className="note-preview-by">— {animalLabel(stats.latest.author, lang)}</span>
        </p>
      )}

      <div className="note-footer">
        {stats && stats.count > 0 ? (
          <span className="note-rating">
            <Stars value={stats.avgRating} /> {stats.avgRating.toFixed(1)} ({stats.count})
          </span>
        ) : (
          <span className="note-rating muted">{t('noReviewsShort')}</span>
        )}
        <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
      </div>
    </article>
  );
}
