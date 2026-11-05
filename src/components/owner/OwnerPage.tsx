// Page for shops (#shop): join ThisCount, see your application, or your shop dashboard

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';
import { loadMyApplication, type MyApplication } from '../../api/owners';
import { shortDate } from '../../utils/dates';
import { OwnerApplyForm } from './OwnerApplyForm';
import { OwnerDashboard } from './OwnerDashboard';
import type { ShopPhoto } from '../../api/shopPhotos';
import type { Deal, Profile, ReviewStats } from '../../types';

interface Props {
  userId: string | null;
  profile: Profile | null;
  deals: Deal[];
  reviewStats: Record<string, ReviewStats>;
  photos: Record<string, ShopPhoto[]>;
  onPhotosChanged: () => void;
  onLogin: () => void;
  onOpenDeal: (dealId: string) => void;
  onProfileChanged: () => void;
  onBack: () => void;
}

export function OwnerPage({ userId, profile, deals, reviewStats, photos, onPhotosChanged, onLogin, onOpenDeal, onProfileChanged, onBack }: Props) {
  const { t } = useLanguage();
  const [application, setApplication] = useState<MyApplication | null>(null);
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [applyAgain, setApplyAgain] = useState(false);

  const isOwner = profile?.role === 'owner';

  const loadApplication = useCallback(() => {
    if (!userId || !supabase) {
      setState('ready');
      return;
    }
    loadMyApplication(userId)
      .then((a) => {
        setApplication(a);
        // Approved since last time? Reload the profile so the dashboard shows
        if (a?.status === 'approved' && !isOwner) onProfileChanged();
      })
      .catch((err) => console.error('[ThisCount] my application', err))
      .finally(() => setState('ready'));
  }, [userId, isOwner, onProfileChanged]);

  useEffect(loadApplication, [loadApplication]);

  const myDeals = deals.filter((d) => userId && d.ownerId === userId);

  return (
    <main className="container profile">
      <div className="admin-head">
        <h1 className="admin-title">{isOwner ? t('ownerDashTitle') : t('shopPageTitle')}</h1>
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← {t('adminBack')}
        </button>
      </div>

      {/* Approved owner → dashboard */}
      {isOwner && profile && userId ? (
        <OwnerDashboard
          userId={userId}
          profile={profile}
          myDeals={myDeals}
          reviewStats={reviewStats}
          photos={photos}
          onPhotosChanged={onPhotosChanged}
          onOpenDeal={onOpenDeal}
        />
      ) : (
        <>
          {/* Why join */}
          <section className="admin-item shop-intro">
            <p className="shop-lede">{t('shopIntro')}</p>
            <ul className="shop-benefits">
              <li>{t('shopBenefit1')}</li>
              <li>{t('shopBenefit2')}</li>
              <li>{t('shopBenefit3')}</li>
            </ul>
            <p className="muted small">{t('shopFree')}</p>
          </section>

          {!supabase ? (
            <p className="muted">{t('loginOffline')}</p>
          ) : !userId ? (
            <section className="admin-item">
              <p>{t('shopLoginFirst')}</p>
              <p className="muted small">{t('shopSeparateAccount')}</p>
              <button type="button" className="btn-primary" onClick={onLogin}>
                {t('signup')} / {t('login')}
              </button>
            </section>
          ) : state === 'loading' ? (
            <p className="empty">{t('loading')}</p>
          ) : application?.status === 'pending' ? (
            <section className="admin-item">
              <span className="tag">{t('statusPending')}</span>
              <p>
                <strong>{application.shopName}</strong> · {application.offer}
              </p>
              <p className="muted">
                {t('shopPendingText')} ({t('submittedOn')} {shortDate(application.createdAt)})
              </p>
              <button type="button" className="link-btn" onClick={loadApplication}>
                {t('checkAgain')}
              </button>
            </section>
          ) : application?.status === 'rejected' && !applyAgain ? (
            <section className="admin-item">
              <span className="tag tag-bad">{t('statusRejected')}</span>
              <p className="muted">{t('shopRejectedText')}</p>
              <button type="button" className="btn-ghost" onClick={() => setApplyAgain(true)}>
                {t('applyAgain')}
              </button>
            </section>
          ) : (
            <section className="profile-section">
              <h2 className="section-title">{t('shopApplyTitle')}</h2>
              <OwnerApplyForm
                userId={userId}
                deals={deals}
                onSent={() => {
                  setApplyAgain(false);
                  loadApplication();
                }}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
