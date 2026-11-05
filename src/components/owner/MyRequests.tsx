// Owner's list of discount requests and their status

import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { cancelRequest, type DealRequest } from '../../api/ownerRequests';
import { approvalWindow } from '../../utils/businessDays';
import { formatDay, shortDate } from '../../utils/dates';
import type { Deal } from '../../types';

interface Props {
  requests: DealRequest[];
  deals: Deal[];
  onChanged: () => void;
}

export function MyRequests({ requests, deals, onChanged }: Props) {
  const { t, pick, lang } = useLanguage();
  const [error, setError] = useState('');

  if (requests.length === 0) return <p className="muted">{t('noRequests')}</p>;

  async function cancel(id: number) {
    try {
      await cancelRequest(id);
      onChanged();
    } catch (err) {
      console.error('[ThisCount] cancelRequest', err);
      setError(t('actionError'));
    }
  }

  return (
    <>
      {error && <p className="form-message" data-kind="error">{error}</p>}
      <ul className="admin-list">
        {requests.map((r) => {
          const deal = deals.find((d) => d.id === (r.dealId ?? r.resultDealId));
          const win = approvalWindow(r.createdAt);
          return (
            <li key={r.id} className="admin-item">
              <div className="admin-item-head">
                <span className={`tag ${r.status === 'approved' ? 'tag-good' : r.status === 'rejected' ? 'tag-bad' : ''}`}>
                  {t(r.status === 'pending' ? 'statusPending' : r.status === 'approved' ? 'statusApproved' : 'statusRejected')}
                </span>
                <strong>{r.kind === 'new' ? t('requestNew') : `${t('requestChange')}: ${deal ? pick(deal.name) : '—'}`}</strong>
                <span className="muted small">
                  {t('submittedOn')} {shortDate(r.createdAt)}
                </span>
              </div>
              <p className="admin-offer">{lang === 'en' ? r.offerEn || r.offerZh : r.offerZh || r.offerEn}</p>
              {r.status === 'pending' && (
                <p className="small">
                  {t('expectedDecision')} {formatDay(win.from.toISOString(), lang)} – {formatDay(win.to.toISOString(), lang)}
                </p>
              )}
              {r.status === 'rejected' && r.adminNote && (
                <p className="small">
                  <strong>{t('adminReason')}:</strong> {r.adminNote}
                </p>
              )}
              {r.status === 'pending' && (
                <button type="button" className="link-btn" onClick={() => cancel(r.id)}>
                  {t('cancelRequest')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
