// What an approved shop owner sees: their deals, numbers, and a shortcut to reply to reviews

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { loadDealStats, type DealStats } from '../../api/stats';
import { formatRange } from '../../utils/dates';
import { Stars } from '../Stars';
import { listMyRequests, type DealRequest } from '../../api/ownerRequests';
import { DealRequestForm } from './DealRequestForm';
import { MyRequests } from './MyRequests';
import { ShopPhotoManager } from '../ShopPhotoManager';
import type { ShopPhoto } from '../../api/shopPhotos';
import type { Deal, Profile, ReviewStats } from '../../types';

const NO_STATS: DealStats = { views: 0, mapClicks: 0, shares: 0, saves: 0, reviews: 0, score: 0 };

interface Props {
  userId: string;
  profile: Profile;
  myDeals: Deal[];
  reviewStats: Record<string, ReviewStats>;
  photos: Record<string, ShopPhoto[]>;
  onPhotosChanged: () => void;
  onOpenDeal: (dealId: string) => void;
}

export function OwnerDashboard({ userId, profile, myDeals, reviewStats, photos, onPhotosChanged, onOpenDeal }: Props) {
  const { t, pick, lang } = useLanguage();
  const [stats, setStats] = useState<Record<string, DealStats>>({});
  const [requests, setRequests] = useState<DealRequest[]>([]);
  const [formFor, setFormFor] = useState<string | 'new' | null>(null); // deal id, "new", or closed
  const [notice, setNotice] = useState('');

  const loadRequests = useCallback(() => {
    listMyRequests(userId)
      .then(setRequests)
      .catch((err) => console.error('[ThisCount] my requests', err));
  }, [userId]);

  useEffect(loadRequests, [loadRequests]);

  function sent() {
    setFormFor(null);
    setNotice(t('requestSent'));
    loadRequests();
  }

  useEffect(() => {
    loadDealStats(7)
      .then(setStats)
      .catch((err) => console.error('[ThisCount] owner stats', err));
  }, []);

  return (
    <>
      <section className="admin-item profile-card">
        <div className="profile-hero">
          <span className="avatar avatar-big" aria-hidden="true">
            {profile.shopName ? Array.from(profile.shopName)[0] : 'S'}
          </span>
          <div>
            <p className="profile-name">{profile.shopName}</p>
            <span className="role-badge role-owner">{t('ownerBadge')}</span>
          </div>
        </div>
        <p className="muted small">{t('ownerDashHint')}</p>
      </section>

      <section className="profile-section">
        <div className="admin-head">
          <h2 className="section-title">{t('ownerMyDeals')}</h2>
          <button type="button" className="btn-primary" onClick={() => setFormFor('new')} disabled={formFor === 'new'}>
            + {t('submitNewDiscount')}
          </button>
        </div>
        {notice && <p className="form-message" data-kind="ok">{notice}</p>}
        {formFor === 'new' && (
          <div className="admin-item">
            <strong>{t('submitNewDiscount')}</strong>
            <DealRequestForm userId={userId} deal={null} onSent={sent} onCancel={() => setFormFor(null)} />
          </div>
        )}
        {myDeals.length === 0 && <p className="muted">{t('ownerNoDeals')}</p>}
        <ul className="admin-list">
          {myDeals.map((deal) => {
            const s = stats[deal.id] ?? NO_STATS;
            const r = reviewStats[deal.id];
            return (
              <li key={deal.id} className="admin-item">
                <div className="admin-item-head">
                  <strong>{pick(deal.name)}</strong>
                  <span className="tag">{t(`cat.${deal.category}`)}</span>
                </div>
                <p className="admin-offer">{pick(deal.offer)}</p>
                <p className="muted small">
                  {deal.area} · {formatRange(deal.addedAt, deal.validUntil, lang)}
                </p>
                <p className="stat-line">
                  <span>{s.views} {t('statViews')}</span>
                  <span>{s.mapClicks} {t('statMap')}</span>
                  <span>{s.saves} {t('statSaves')}</span>
                  <span className="muted">({t('last7days')})</span>
                </p>
                <p className="stat-line">
                  {r && r.count > 0 ? (
                    <>
                      <Stars value={r.avgRating} /> <strong>{r.avgRating.toFixed(1)}</strong>
                      <span className="muted">
                        ({r.count} {t('reviewCount')})
                      </span>
                      <span className="tag tag-good">{r.worked} {t('worked')}</span>
                      <span className="tag tag-bad">{r.didnt} {t('didnt')}</span>
                    </>
                  ) : (
                    <span className="muted">{t('noReviewsShort')}</span>
                  )}
                </p>
                <ShopPhotoManager
                  dealId={deal.id}
                  photos={photos[deal.id] ?? []}
                  userId={userId}
                  canAdd
                  onChanged={onPhotosChanged}
                />
                {formFor === deal.id ? (
                  <DealRequestForm userId={userId} deal={deal} onSent={sent} onCancel={() => setFormFor(null)} />
                ) : (
                  <div className="row-gap">
                    <button type="button" className="btn-primary" onClick={() => onOpenDeal(deal.id)}>
                      {t('ownerReplyReviews')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setFormFor(deal.id)}>
                      {t('requestChangeButton')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="profile-section">
        <h2 className="section-title">{t('myRequests')}</h2>
        <p className="muted small">{t('approvalTime')}</p>
        <MyRequests requests={requests} deals={myDeals} onChanged={loadRequests} />
      </section>
    </>
  );
}
