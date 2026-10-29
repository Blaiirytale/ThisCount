// "List your shop" pop-up: shop owners apply, an admin approves

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { applyAsOwner } from '../api/owners';
import { isBlockedLanguage } from '../api/reviews';
import { Modal, ModalHeader } from './Modal';
import type { Deal, Profile } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  profile: Profile | null;
  deals: Deal[];
  onLogin: () => void;
}

const EMPTY = { shopName: '', contact: '', dealId: '', message: '' };

export function OwnerApplyDialog({ open, onClose, userId, profile, deals, onLogin }: Props) {
  const { t, pick } = useLanguage();
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  function close() {
    setStatus('idle');
    setError('');
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return onLogin();
    if (!form.shopName.trim() || !form.contact.trim()) return setError(t('applyMissing'));
    setStatus('sending');
    setError('');
    try {
      await applyAsOwner({ ...form, dealId: form.dealId || null }, userId);
      setForm(EMPTY);
      setStatus('sent');
    } catch (err) {
      console.error('[ThisCount] applyAsOwner', err);
      setStatus('idle');
      setError(isBlockedLanguage(err) ? t('blockedLanguage') : t('actionError'));
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="owner-title">
      <ModalHeader id="owner-title" title={t('ownerTitle')} onClose={close} closeLabel={t('close')} />

      {profile?.role === 'owner' ? (
        <p className="form-message" data-kind="ok">
          {t('ownerAlready')} {profile.shopName}
        </p>
      ) : !userId ? (
        <>
          <p className="muted">{t('ownerIntro')}</p>
          <button type="button" className="btn-primary" onClick={onLogin}>
            {t('loginToApply')}
          </button>
        </>
      ) : status === 'sent' ? (
        <p className="form-message" data-kind="ok">{t('applySent')}</p>
      ) : (
        <form className="stack" onSubmit={handleSubmit} noValidate>
          <p className="muted">{t('ownerIntro')}</p>
          <label className="form-row" htmlFor="o-shop">
            <span>{t('fieldShop')}</span>
            <input id="o-shop" className="field" maxLength={100} value={form.shopName} onChange={(e) => set('shopName')(e.target.value)} />
          </label>
          <label className="form-row" htmlFor="o-contact">
            <span>{t('fieldContact')}</span>
            <input id="o-contact" className="field" maxLength={100} value={form.contact} onChange={(e) => set('contact')(e.target.value)} />
          </label>
          <label className="form-row" htmlFor="o-deal">
            <span>{t('fieldYourShop')}</span>
            <select id="o-deal" className="field" value={form.dealId} onChange={(e) => set('dealId')(e.target.value)}>
              <option value="">{t('shopNotListed')}</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {pick(d.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row" htmlFor="o-message">
            <span>{t('fieldMessage')}</span>
            <textarea id="o-message" className="field" rows={3} maxLength={500} value={form.message} onChange={(e) => set('message')(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={status === 'sending'}>
            {status === 'sending' ? t('sending') : t('applyButton')}
          </button>
          {error && <p className="form-message" data-kind="error">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
