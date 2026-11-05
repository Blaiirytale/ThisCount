// Application form for shops that want to join

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { applyAsOwner, isAlreadyPending } from '../../api/owners';
import { isBlockedLanguage } from '../../api/reviews';
import { CATEGORIES, type Category, type Deal } from '../../types';

interface Props {
  userId: string;
  deals: Deal[];
  onSent: () => void;
}

const EMPTY = { shopName: '', contact: '', area: '', category: '' as Category | '', offer: '', dealId: '', message: '' };

export function OwnerApplyForm({ userId, deals, onSent }: Props) {
  const { t, pick } = useLanguage();
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.shopName.trim() || !form.contact.trim() || !form.offer.trim()) return setError(t('shopApplyMissing'));
    setSending(true);
    setError('');
    try {
      await applyAsOwner(
        {
          shopName: form.shopName,
          contact: form.contact,
          area: form.area,
          category: form.category || null,
          offer: form.offer,
          dealId: form.dealId || null,
          message: form.message,
        },
        userId,
      );
      setForm(EMPTY);
      onSent();
    } catch (err) {
      console.error('[ThisCount] applyAsOwner', err);
      setError(
        isBlockedLanguage(err) ? t('blockedLanguage') : isAlreadyPending(err) ? t('shopAlreadyPending') : t('actionError'),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <label className="form-row" htmlFor="shop-name">
        <span>{t('fieldShop')} *</span>
        <input id="shop-name" className="field" maxLength={100} value={form.shopName} onChange={(e) => set('shopName')(e.target.value)} />
      </label>
      <label className="form-row" htmlFor="shop-contact">
        <span>{t('fieldContact')} *</span>
        <input id="shop-contact" className="field" maxLength={100} value={form.contact} onChange={(e) => set('contact')(e.target.value)} />
      </label>
      <label className="form-row" htmlFor="shop-category">
        <span>{t('fieldCategory')}</span>
        <select id="shop-category" className="field" value={form.category} onChange={(e) => set('category')(e.target.value)}>
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`cat.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="form-row" htmlFor="shop-area">
        <span>{t('fieldArea')}</span>
        <input id="shop-area" className="field" maxLength={100} value={form.area} onChange={(e) => set('area')(e.target.value)} />
      </label>
      <label className="form-row full" htmlFor="shop-offer">
        <span>{t('fieldShopOffer')} *</span>
        <input
          id="shop-offer"
          className="field"
          maxLength={200}
          placeholder={t('shopOfferPlaceholder')}
          value={form.offer}
          onChange={(e) => set('offer')(e.target.value)}
        />
      </label>
      <label className="form-row full" htmlFor="shop-deal">
        <span>{t('fieldYourShop')}</span>
        <select id="shop-deal" className="field" value={form.dealId} onChange={(e) => set('dealId')(e.target.value)}>
          <option value="">{t('shopNotListed')}</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {pick(d.name)}
            </option>
          ))}
        </select>
      </label>
      <label className="form-row full" htmlFor="shop-message">
        <span>{t('fieldMessage')}</span>
        <textarea id="shop-message" className="field" rows={3} maxLength={500} value={form.message} onChange={(e) => set('message')(e.target.value)} />
      </label>
      <div className="row-gap full">
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? t('sending') : t('applyButton')}
        </button>
      </div>
      {error && <p className="form-message" data-kind="error">{error}</p>}
    </form>
  );
}
