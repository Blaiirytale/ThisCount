// Tab 2: shops that want an owner account

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { decideOwnerApplication, listOwnerApplications, type OwnerApplication, type ReviewStatus } from '../../api/admin';
import { shortDate } from '../../utils/dates';
import { StatusFilter } from './StatusFilter';
import type { Deal } from '../../types';

interface Props {
  deals: Deal[];
  onDealsChanged: () => void;
  onCountChange: (pending: number) => void;
}

export function OwnersPanel({ deals, onDealsChanged, onCountChange }: Props) {
  const { t, pick } = useLanguage();
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [items, setItems] = useState<OwnerApplication[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [chosenDeal, setChosenDeal] = useState<Record<number, string>>({}); // admin can change the linked deal
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await listOwnerApplications(status);
      setItems(list);
      if (status === 'pending') onCountChange(list.length);
      setState('ready');
    } catch (err) {
      console.error('[ThisCount] owner applications', err);
      setState('error');
    }
  }, [status, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(item: OwnerApplication, next: ReviewStatus) {
    const dealId = chosenDeal[item.id] ?? item.dealId ?? '';
    try {
      await decideOwnerApplication(item.id, next, dealId || null);
      setNotice(next === 'approved' ? t('ownerApproved') : '');
      if (next === 'approved') onDealsChanged();
      await load();
    } catch (err) {
      console.error('[ThisCount] decideOwnerApplication', err);
      setNotice(t('actionError'));
    }
  }

  return (
    <section className="admin-panel">
      <StatusFilter value={status} onChange={setStatus} />
      {notice && <p className="form-message" data-kind="ok">{notice}</p>}
      {state === 'error' && <p className="muted">{t('actionError')}</p>}
      {state === 'ready' && items.length === 0 && <p className="muted">{t('nothingHere')}</p>}

      <ul className="admin-list">
        {items.map((item) => (
          <li key={item.id} className="admin-item">
            <div className="admin-item-head">
              <strong>{item.shopName}</strong>
              <span className="muted small">
                {t('submittedOn')} {shortDate(item.createdAt)}
              </span>
            </div>
            <dl className="facts">
              <div>
                <dt>{t('contact')}</dt>
                <dd>{item.contact}</dd>
              </div>
              <div>
                <dt>{t('linkedDeal')}</dt>
                <dd>{item.dealName ? pick(item.dealName) : t('noLinkedDeal')}</dd>
              </div>
            </dl>
            {item.message && (
              <p className="admin-message">
                <span className="muted small">{t('message')}: </span>
                {item.message}
              </p>
            )}

            {item.status === 'pending' && (
              <>
                <label className="form-row" htmlFor={`owner-deal-${item.id}`}>
                  <span>{t('linkedDeal')}</span>
                  <select
                    id={`owner-deal-${item.id}`}
                    className="field"
                    value={chosenDeal[item.id] ?? item.dealId ?? ''}
                    onChange={(e) => setChosenDeal((c) => ({ ...c, [item.id]: e.target.value }))}
                  >
                    <option value="">{t('noLinkedDeal')}</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {pick(d.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted small">{t('ownerApproveHint')}</p>
                <div className="row-gap">
                  <button type="button" className="btn-primary" onClick={() => decide(item, 'approved')}>
                    {t('approve')}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => decide(item, 'rejected')}>
                    {t('reject')}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
