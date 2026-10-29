// "Know another deal?" form at the bottom of the page

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { submitDeal } from '../api/submissions';
import { CATEGORIES, type Category } from '../types';

interface Props {
  userId: string | null;
  onLogin: () => void;
}

const EMPTY = { shop: '', category: 'food' as Category, offer: '', conditions: '' };

export function SubmitForm({ userId, onLogin }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  // Update one field
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return onLogin();
    if (!form.shop.trim() || !form.offer.trim()) {
      return setMessage({ text: t('submitMissing'), kind: 'error' });
    }
    setSending(true);
    try {
      await submitDeal(form, userId);
      setForm(EMPTY);
      setMessage({ text: t('submitSuccess'), kind: 'ok' });
    } catch (err) {
      console.error('[ThisCount] submit', err);
      setMessage({ text: t('submitError'), kind: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="submit" aria-labelledby="submit-title">
      <div>
        <h2 id="submit-title">{t('submitTitle')}</h2>
        <p className="muted">{t('submitIntro')}</p>
      </div>

      {userId ? (
        <form className="submit-form" onSubmit={handleSubmit} noValidate>
          <label className="form-row" htmlFor="f-shop">
            <span>{t('fieldShop')}</span>
            <input id="f-shop" className="field" maxLength={100} value={form.shop} onChange={(e) => set('shop')(e.target.value)} />
          </label>
          <label className="form-row" htmlFor="f-category">
            <span>{t('fieldCategory')}</span>
            <select id="f-category" className="field" value={form.category} onChange={(e) => set('category')(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cat.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row full" htmlFor="f-offer">
            <span>{t('fieldOffer')}</span>
            <input id="f-offer" className="field" maxLength={200} value={form.offer} onChange={(e) => set('offer')(e.target.value)} />
          </label>
          <label className="form-row full" htmlFor="f-conditions">
            <span>{t('fieldConditions')}</span>
            <input id="f-conditions" className="field" maxLength={200} value={form.conditions} onChange={(e) => set('conditions')(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? t('sending') : t('submitButton')}
          </button>
          {message && (
            <p className="form-message" data-kind={message.kind} role="status">
              {message.text}
            </p>
          )}
        </form>
      ) : (
        <div>
          <button type="button" className="btn-primary" onClick={onLogin}>
            {t('submitLoginPrompt')}
          </button>
        </div>
      )}
    </section>
  );
}
