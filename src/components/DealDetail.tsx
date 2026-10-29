// Details pop-up: full info, favorite, reviews

import { useLanguage } from '../i18n/LanguageContext';
import { formatRange } from '../utils/dates';
import { Modal, ModalHeader } from './Modal';
import { FavoriteButton } from './FavoriteButton';
import { ReviewSection } from './ReviewSection';
import type { Deal, Profile, ReviewStats } from '../types';

interface Props {
  deal: Deal | null; // null = closed
  stats?: ReviewStats;
  isFavorite: boolean;
  userId: string | null;
  profile: Profile | null;
  onClose: () => void;
  onToggleFavorite: () => void;
  onLogin: () => void;
  onReviewsChanged: () => void;
}

export function DealDetail(props: Props) {
  const { deal, stats, isFavorite, userId, profile, onClose, onToggleFavorite, onLogin, onReviewsChanged } = props;
  const { t, pick, lang } = useLanguage();

  return (
    <Modal open={deal !== null} onClose={onClose} labelledBy="deal-title">
      {deal && (
        <>
          <ModalHeader id="deal-title" title={pick(deal.name)} onClose={onClose} closeLabel={t('close')} />
          <p className="detail-offer">{pick(deal.offer)}</p>
          <p className="card-conditions">{pick(deal.conditions)}</p>

          <dl className="facts">
            <div>
              <dt>{t('area')}</dt>
              <dd>{deal.area}</dd>
            </div>
            <div>
              <dt>{t('validDates')}</dt>
              <dd>{formatRange(deal.addedAt, deal.validUntil, lang)}</dd>
            </div>
            <div>
              <dt>{t('lastChecked')}</dt>
              <dd>{deal.lastChecked}</dd>
            </div>
          </dl>

          <div className="detail-actions">
            <a
              className="btn-ghost"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deal.mapQuery)}`}
              target="_blank"
              rel="noopener"
            >
              {t('openMap')} ↗
            </a>
            <FavoriteButton active={isFavorite} onClick={onToggleFavorite} />
          </div>

          {/* key resets the review form when you open another deal */}
          <ReviewSection
            key={deal.id}
            deal={deal}
            stats={stats}
            userId={userId}
            profile={profile}
            onLogin={onLogin}
            onChanged={onReviewsChanged}
          />
        </>
      )}
    </Modal>
  );
}
