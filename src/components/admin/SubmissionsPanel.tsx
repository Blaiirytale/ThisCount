// Tab 1: deals students sent in

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { listSubmissions, setSubmissionStatus, type ReviewStatus, type Submission } from '../../api/admin';
import { shortDate } from '../../utils/dates';
import { ApproveDealForm } from './ApproveDealForm';
import { StatusFilter } from './StatusFilter';

interface Props {
  onDealsChanged: () => void;
  onCountChange: (pending: number) => void;
}

export function SubmissionsPanel({ onDealsChanged, onCountChange }: Props) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [items, setItems] = useState<Submission[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [openId, setOpenId] = useState<number | null>(null); // which one is being published
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await listSubmissions(status);
      setItems(list);
      if (status === 'pending') onCountChange(list.length);
      setState('ready');
    } catch (err) {
      console.error('[ThisCount] submissions', err);
      setState('error');
    }
  }, [status, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(item: Submission, next: ReviewStatus) {
    try {
      await setSubmissionStatus(item.id, next);
      setNotice('');
      await load();
    } catch (err) {
      console.error('[ThisCount] setSubmissionStatus', err);
      setNotice(t('actionError'));
    }
  }

  async function published(item: Submission) {
    setOpenId(null);
    await decide(item, 'approved');
    setNotice(t('published'));
    onDealsChanged();
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
              <strong>{item.shop}</strong>
              <span className="tag">{t(`cat.${item.category}`)}</span>
              <span className="muted small">
                {t('submittedOn')} {shortDate(item.createdAt)}
              </span>
            </div>
            <p className="admin-offer">{item.offer}</p>
            {item.conditions && <p className="muted">{item.conditions}</p>}

            {item.status === 'pending' &&
              (openId === item.id ? (
                <ApproveDealForm submission={item} onPublished={() => published(item)} onCancel={() => setOpenId(null)} />
              ) : (
                <div className="row-gap">
                  <button type="button" className="btn-primary" onClick={() => setOpenId(item.id)}>
                    {t('approve')}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => decide(item, 'rejected')}>
                    {t('reject')}
                  </button>
                </div>
              ))}
            {item.status === 'rejected' && (
              <button type="button" className="link-btn" onClick={() => decide(item, 'pending')}>
                {t('moveToPending')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
