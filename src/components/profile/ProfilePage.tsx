// My profile (#profile): name picker, my reviews, password, log out

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { animalEmoji, animalLabel } from '../../i18n/animals';
import { changePassword, listUserReviews, rerollMyAnimal } from '../../api/profile';
import { deleteReview } from '../../api/reviews';
import { signOut } from '../../hooks/useAuth';
import { UserReviewList } from './UserReviewList';
import type { Profile, UserReview } from '../../types';

const MIN_PASSWORD = 6;

interface Props {
  userId: string | null;
  profile: Profile | null;
  onProfileChanged: () => void;
  onReviewsChanged: () => void;
  onOpenDeal: (dealId: string) => void;
  onLogin: () => void;
  onBack: () => void;
}

export function ProfilePage({ userId, profile, onProfileChanged, onReviewsChanged, onOpenDeal, onLogin, onBack }: Props) {
  const { t, lang } = useLanguage();

  // Random name
  const [nameMsg, setNameMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const [savingName, setSavingName] = useState(false);

  // My reviews
  const [reviews, setReviews] = useState<UserReview[]>([]);

  // Password
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const loadReviews = useCallback(() => {
    if (!userId) return;
    listUserReviews(userId)
      .then(setReviews)
      .catch((err) => console.error('[ThisCount] my reviews', err));
  }, [userId]);

  useEffect(loadReviews, [loadReviews]);

  if (!userId) {
    return (
      <main className="container profile">
        <p className="empty">{t('loginToProfile')}</p>
        <div className="row-gap">
          <button type="button" className="btn-primary" onClick={onLogin}>
            {t('login')}
          </button>
          <button type="button" className="btn-ghost" onClick={onBack}>
            ← {t('adminBack')}
          </button>
        </div>
      </main>
    );
  }

  async function rollName() {
    setSavingName(true);
    setNameMsg(null);
    try {
      await rerollMyAnimal();
      setNameMsg({ text: t('nameSaved'), kind: 'ok' });
      onProfileChanged();
      onReviewsChanged(); // card previews show names too
    } catch (err) {
      console.error('[ThisCount] reroll', err);
      const used = String((err as { message?: string })?.message ?? '').includes('reroll_used');
      setNameMsg({ text: used ? t('rerollUsed') : t('actionError'), kind: 'error' });
      if (used) onProfileChanged(); // refresh so the button shows as used
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setPwMsg({ text: t('authWeakPassword'), kind: 'error' });
    try {
      await changePassword(password);
      setPassword('');
      setPwMsg({ text: t('passwordChanged'), kind: 'ok' });
    } catch (err) {
      console.error('[ThisCount] changePassword', err);
      setPwMsg({ text: t('actionError'), kind: 'error' });
    }
  }

  async function removeReview(r: UserReview) {
    try {
      await deleteReview(r);
      loadReviews();
      onReviewsChanged();
    } catch (err) {
      console.error('[ThisCount] delete my review', err);
    }
  }

  const preview = profile?.animal ?? null;

  return (
    <main className="container profile">
      <div className="admin-head">
        <h1 className="admin-title">{t('myProfile')}</h1>
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← {t('adminBack')}
        </button>
      </div>

      {/* Name card */}
      {preview && (
        <section className="admin-item profile-card">
          <div className="profile-hero">
            <span className="avatar avatar-big" aria-hidden="true">
              {animalEmoji(preview)}
            </span>
            <div>
              <p className="profile-name">{animalLabel(preview, lang)}</p>
              {profile?.role === 'owner' && (
                <span className="role-badge role-owner">
                  {t('ownerBadge')} · {profile.shopName}
                </span>
              )}
              {profile?.isAdmin && <span className="role-badge role-admin">{t('adminBadge')}</span>}
            </div>
          </div>

          <div className="name-form">
            <p className="muted small">{t('nameHint')}</p>
            <div className="row-gap">
              {profile?.nameRerolled ? (
                <span className="muted small">🔒 {t('rerollUsed')}</span>
              ) : (
                <button type="button" className="btn-primary" onClick={rollName} disabled={savingName}>
                  {savingName ? t('sending') : t('newRandomName')}
                </button>
              )}
              <a className="link-btn" href={`#user-${userId}`}>
                {t('publicProfile')}
              </a>
            </div>
            {nameMsg && <p className="form-message" data-kind={nameMsg.kind}>{nameMsg.text}</p>}
          </div>
        </section>
      )}

      {/* My reviews */}
      <section className="profile-section">
        <h2 className="section-title">{t('myReviews')}</h2>
        <UserReviewList reviews={reviews} emptyText={t('noMyReviews')} onOpenDeal={onOpenDeal} onDelete={removeReview} />
      </section>

      {/* Password + log out */}
      <section className="profile-section admin-item">
        <h2 className="section-title">{t('changePassword')}</h2>
        <form className="stack" onSubmit={savePassword} noValidate>
          <label className="form-row" htmlFor="new-password">
            <span>{t('newPassword')}</span>
            <div className="password-box">
              <input
                id="new-password"
                className="field"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="link-btn" aria-pressed={showPassword} onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? t('hidePassword') : t('showPassword')}
              </button>
            </div>
          </label>
          <button type="submit" className="btn-primary">
            {t('changePassword')}
          </button>
          {pwMsg && <p className="form-message" data-kind={pwMsg.kind}>{pwMsg.text}</p>}
        </form>
        <button type="button" className="btn-ghost logout-btn" onClick={() => signOut().then(onBack)}>
          {t('logout')}
        </button>
      </section>
    </main>
  );
}
