// Deal form used for: new deal, editing a deal, publishing a student's submission

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CATEGORIES } from '../../types';
import type { DealInput } from '../../api/admin';

// Empty form for a brand-new deal
export function emptyDeal(): DealInput {
  return {
    category: 'food',
    area: '',
    name: { zh: '', en: '' },
    offer: { zh: '', en: '' },
    conditions: { zh: '', en: '' },
    mapQuery: '淡水 ',
    validUntil: null,
    lastChecked: today(),
    isActive: true,
  };
}

export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()); // YYYY-MM-DD
}

interface Props {
  formId: string;            // unique, keeps input ids different on the page
  initial: DealInput;
  submitLabel: string;
  showActive?: boolean;      // show the "shown on site" checkbox
  onSave: (input: DealInput) => Promise<void>;
  onCancel: () => void;
}

export function DealForm({ formId, initial, submitLabel, showActive = false, onSave, onCancel }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<DealInput>(initial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const id = (key: string) => `${formId}-${key}`;

  // Update one language of a { zh, en } field
  const setText = (key: 'name' | 'offer' | 'conditions', lang: 'zh' | 'en') => (value: string) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], [lang]: value } }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const required = [form.name.zh, form.name.en, form.offer.zh, form.offer.en, form.area];
    if (required.some((v) => !v.trim())) return setError(t('dealMissing'));
    setSending(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      console.error('[ThisCount] save deal', err);
      setError(t('actionError'));
      setSending(false);
    }
  }

  const textField = (key: 'name' | 'offer' | 'conditions', lang: 'zh' | 'en', label: string) => (
    <label className="form-row" htmlFor={id(`${key}-${lang}`)}>
      <span>{label}</span>
      <input
        id={id(`${key}-${lang}`)}
        className="field"
        maxLength={200}
        value={form[key][lang]}
        onChange={(e) => setText(key, lang)(e.target.value)}
      />
    </label>
  );

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <p className="muted small full">{t('publishHint')}</p>
      {textField('name', 'zh', t('fieldNameZh'))}
      {textField('name', 'en', t('fieldNameEn'))}
      {textField('offer', 'zh', t('fieldOfferZh'))}
      {textField('offer', 'en', t('fieldOfferEn'))}
      {textField('conditions', 'zh', t('fieldConditionsZh'))}
      {textField('conditions', 'en', t('fieldConditionsEn'))}

      <label className="form-row" htmlFor={id('category')}>
        <span>{t('fieldCategory')}</span>
        <select
          id={id('category')}
          className="field"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DealInput['category'] }))}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`cat.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="form-row" htmlFor={id('area')}>
        <span>{t('fieldArea')}</span>
        <input id={id('area')} className="field" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
      </label>
      <label className="form-row full" htmlFor={id('map')}>
        <span>{t('fieldMapQuery')}</span>
        <input id={id('map')} className="field" value={form.mapQuery} onChange={(e) => setForm((f) => ({ ...f, mapQuery: e.target.value }))} />
      </label>
      <label className="form-row" htmlFor={id('checked')}>
        <span>{t('fieldLastChecked')}</span>
        <input
          id={id('checked')}
          className="field"
          type="date"
          value={form.lastChecked}
          onChange={(e) => setForm((f) => ({ ...f, lastChecked: e.target.value }))}
        />
      </label>
      <label className="form-row" htmlFor={id('until')}>
        <span>{t('fieldValidUntil')}</span>
        <input
          id={id('until')}
          className="field"
          type="date"
          value={form.validUntil ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value || null }))}
        />
      </label>

      {showActive && (
        <label className="check-row full" htmlFor={id('active')}>
          <input
            id={id('active')}
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <span>{t('fieldActive')}</span>
        </label>
      )}

      <div className="row-gap full">
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? t('sending') : submitLabel}
        </button>
        <button type="button" className="link-btn" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
      {error && <p className="form-message" data-kind="error">{error}</p>}
    </form>
  );
}
