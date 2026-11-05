// Owner form: new discount, or a change to one of their deals. Goes to admins for approval.

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { requestErrorKey, sendRequest, type RequestInput } from '../../api/ownerRequests';
import { CATEGORIES, type Deal } from '../../types';

interface Props {
  userId: string;
  deal: Deal | null; // null = new discount, otherwise the deal to change
  onSent: () => void;
  onCancel: () => void;
}

export function DealRequestForm({ userId, deal, onSent, onCancel }: Props) {
  const { t } = useLanguage();
  // Changes start from the deal's current info
  const [form, setForm] = useState<RequestInput>(() => ({
    kind: deal ? 'update' : 'new',
    dealId: deal?.id ?? null,
    category: deal?.category ?? 'food',
    area: deal?.area ?? '',
    offerZh: deal?.offer.zh ?? '',
    offerEn: deal?.offer.en ?? '',
    conditionsZh: deal?.conditions.zh ?? '',
    conditionsEn: deal?.conditions.en ?? '',
    validUntil: deal?.validUntil ?? null,
    note: '',
  }));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof RequestInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const id = (key: string) => `req-${deal?.id ?? 'new'}-${key}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.offerZh.trim() && !form.offerEn.trim()) return setError(t('requestOfferMissing'));
    setSending(true);
    setError('');
    try {
      await sendRequest(form, userId);
      onSent();
    } catch (err) {
      console.error('[ThisCount] sendRequest', err);
      setError(t(requestErrorKey(err)));
      setSending(false);
    }
  }

  const text = (key: keyof RequestInput, label: string, full = false) => (
    <label className={full ? 'form-row full' : 'form-row'} htmlFor={id(key)}>
      <span>{label}</span>
      <input
        id={id(key)}
        className="field"
        maxLength={200}
        value={(form[key] as string) ?? ''}
        onChange={(e) => set(key)(e.target.value)}
      />
    </label>
  );

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <p className="muted small full">{t('requestFormHint')}</p>
      {text('offerZh', t('fieldOfferZh'))}
      {text('offerEn', t('fieldOfferEnOptional'))}
      {text('conditionsZh', t('fieldConditionsZh'))}
      {text('conditionsEn', t('fieldConditionsEnOptional'))}
      <label className="form-row" htmlFor={id('category')}>
        <span>{t('fieldCategory')}</span>
        <select
          id={id('category')}
          className="field"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RequestInput['category'] }))}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`cat.${c}`)}
            </option>
          ))}
        </select>
      </label>
      {text('area', t('fieldArea'))}
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
      <label className="form-row full" htmlFor={id('note')}>
        <span>{t('fieldNoteToAdmin')}</span>
        <textarea id={id('note')} className="field" rows={2} maxLength={500} value={form.note} onChange={(e) => set('note')(e.target.value)} />
      </label>
      <p className="approval-note full">{t('approvalTime')}</p>
      <div className="row-gap full">
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? t('sending') : t('sendForApproval')}
        </button>
        <button type="button" className="link-btn" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
      {error && <p className="form-message" data-kind="error">{error}</p>}
    </form>
  );
}
