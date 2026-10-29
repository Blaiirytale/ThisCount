// Tab 3: reviews students reported

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { deleteReportedReview, listReportedReviews, restoreReview, type ReportedReview } from '../../api/admin';
import { shortDate } from '../../utils/dates';
import { Stars } from '../Stars';
import type { ReportReason } from '../../types';

const REASONS: ReportReason[] = ['spam', 'rude', 'wrong', 'other'];

interface Props {
  onCountChange: (count: number) => void;
}

export function ReportsPanel({ onCountChange }: Props) {
  const { t, pick } = useLanguage();
  const [items, setItems] = useState<ReportedReview[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [confirmId, setConfirmId] = useState<number | null>(null); // delete needs a second click
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await listReportedReviews();
      setItems(list);
      onCountChange(list.length);
      setState('ready');
    } catch (err) {
      console.error('[ThisCount] reported reviews', err);
      setState('error');
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
      setConfirmId(null);
      setNotice('');
      await load();
    } catch (err) {
      console.error('[ThisCount] report action', err);
      setNotice(t('actionError'));
    }
  }

  return (
    <section className="admin-panel">
      {notice && <p className="form-message" data-kind="error">{notice}</p>}
      {state === 'error' && <p className="muted">{t('actionError')}</p>}
      {state === 'ready' && items.length === 0 && <p className="muted">{t('nothingHere')}</p>}

      <ul className="admin-list">
        {items.map((item) => (
          <li key={item.id} className="admin-item">
            <div className="admin-item-head">
              <strong>{item.dealName ? pick(item.dealName) : '—'}</strong>
              <Stars value={item.rating} />
              <span className={item.hidden ? 'tag tag-bad' : 'tag tag-good'}>
                {item.hidden ? t('hiddenStatus') : t('visibleStatus')}
              </span>
              <span className="muted small">{shortDate(item.createdAt)}</span>
            </div>
            {item.body && <p className="review-body">{item.body}</p>}
            <p className="small">
              <strong>
                {item.reportCount} {t('reports')}
              </strong>{' '}
              · {t('reasons')}:{' '}
              {REASONS.filter((r) => item.reasons[r] > 0)
                .map((r) => `${t(`reason.${r}`)} ×${item.reasons[r]}`)
                .join(', ')}
            </p>

            {confirmId === item.id ? (
              <div className="confirm-box">
                <span className="small">{t('confirmDelete')}</span>
                <div className="row-gap">
                  <button type="button" className="btn-danger" onClick={() => run(() => deleteReportedReview(item))}>
                    {t('yesDelete')}
                  </button>
                  <button type="button" className="link-btn" onClick={() => setConfirmId(null)}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="row-gap">
                <button type="button" className="btn-primary" onClick={() => run(() => restoreReview(item.id))}>
                  {t('restore')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmId(item.id)}>
                  {t('deleteForever')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
