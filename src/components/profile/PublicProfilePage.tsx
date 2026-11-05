// Someone's public profile (#user-<id>): name, badges, their reviews

import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { animalInitial, animalLabel } from '../../i18n/animals';
import { getPublicProfile, listUserReviews } from '../../api/profile';
import { shortDate } from '../../utils/dates';
import { UserReviewList } from './UserReviewList';
import { Avatar } from '../Avatar';
import { adminRemoveAvatar } from '../../api/avatars';
import type { PublicProfile, UserReview } from '../../types';

interface Props {
  userId: string;
  viewerIsAdmin: boolean; // admins can remove a bad picture
  onOpenDeal: (dealId: string) => void;
  onBack: () => void;
}

export function PublicProfilePage({ userId, viewerIsAdmin, onOpenDeal, onBack }: Props) {
  const { t, lang } = useLanguage();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([getPublicProfile(userId), listUserReviews(userId)])
      .then(([p, r]) => {
        if (cancelled) return;
        setProfile(p);
        setReviews(r.filter((x) => !x.isHidden)); // never show hidden ones here
        setState(p ? 'ready' : 'missing');
      })
      .catch((err) => {
        console.error('[ThisCount] public profile', err);
        if (!cancelled) setState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <main className="container profile">
      <div className="admin-head">
        <span />
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← {t('adminBack')}
        </button>
      </div>

      {state === 'loading' && <p className="empty">{t('loading')}</p>}
      {state === 'missing' && <p className="empty">{t('profileNotFound')}</p>}

      {state === 'ready' && profile && (
        <>
          <section className="admin-item profile-card">
            <div className="profile-hero">
              <Avatar url={profile.avatarUrl} initial={animalInitial(profile.animal, lang)} size="big" />
              <div>
                <h1 className="profile-name">{animalLabel(profile.animal, lang)}</h1>
                {profile.isAdmin && <span className="role-badge role-admin">{t('adminBadge')}</span>}
                {profile.role === 'owner' && (
                  <span className="role-badge role-owner">
                    {t('ownerBadge')} · {profile.shopName}
                  </span>
                )}
                <p className="muted small">
                  {t('joined')} {shortDate(profile.joinedAt)} · {profile.reviewCount} {t('reviewCount')}
                </p>
                {viewerIsAdmin && profile.avatarUrl && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      adminRemoveAvatar(userId)
                        .then(() => setProfile({ ...profile, avatarUrl: null }))
                        .catch((err) => console.error('[ThisCount] adminRemoveAvatar', err))
                    }
                  >
                    {t('removePicture')}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h2 className="section-title">{t('reviews')}</h2>
            <UserReviewList reviews={reviews} emptyText={t('noReviewsShort')} onOpenDeal={onOpenDeal} />
          </section>
        </>
      )}
    </main>
  );
}
