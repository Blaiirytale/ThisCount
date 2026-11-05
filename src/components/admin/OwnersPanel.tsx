// Tab: shop owners. Pending applications, current owners (with email + contact), rejected.

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { animalLabel } from '../../i18n/animals';
import {
  createDeal,
  decideOwnerApplication,
  listOwnerApplications,
  listShopOwners,
  removeShopOwner,
  type OwnerApplication,
  type ReviewStatus,
  type ShopOwner,
} from '../../api/admin';
import { shortDate } from '../../utils/dates';
import { DealForm, emptyDeal } from './DealForm';
import type { Deal } from '../../types';

type View = 'pending' | 'owners' | 'rejected';

interface Props {
  deals: Deal[];
  onDealsChanged: () => void;
  onCountChange: (pending: number) => void;
}

export function OwnersPanel({ deals, onDealsChanged, onCountChange }: Props) {
  const { t, pick, lang } = useLanguage();
  const [view, setView] = useState<View>('pending');
  const [applications, setApplications] = useState<OwnerApplication[]>([]);
  const [owners, setOwners] = useState<ShopOwner[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [chosenDeal, setChosenDeal] = useState<Record<number, string>>({}); // admin can change the linked deal
  const [creatingFor, setCreatingFor] = useState<number | null>(null); // application id with the deal form open
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      if (view === 'owners') {
        setOwners(await listShopOwners());
      } else {
        const list = await listOwnerApplications(view as ReviewStatus);
        setApplications(list);
        if (view === 'pending') onCountChange(list.length);
      }
      setState('ready');
    } catch (err) {
      console.error('[ThisCount] owners', err);
      setState('error');
    }
  }, [view, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(item: OwnerApplication, next: ReviewStatus, dealId?: string | null) {
    const linked = dealId !== undefined ? dealId : (chosenDeal[item.id] ?? item.dealId ?? '') || null;
    try {
      await decideOwnerApplication(item.id, next, linked);
      setNotice(next === 'approved' ? t('ownerApproved') : '');
      if (next === 'approved') onDealsChanged();
      await load();
    } catch (err) {
      console.error('[ThisCount] decideOwnerApplication', err);
      setNotice(t('actionError'));
    }
  }

  async function remove(owner: ShopOwner) {
    try {
      await removeShopOwner(owner.userId);
      setConfirmRemove(null);
      setNotice(t('ownerRemoved'));
      onDealsChanged();
      await load();
    } catch (err) {
      console.error('[ThisCount] removeShopOwner', err);
      setNotice(t('actionError'));
    }
  }

  const views: { id: View; label: string }[] = [
    { id: 'pending', label: t('statusPending') },
    { id: 'owners', label: t('currentOwners') },
    { id: 'rejected', label: t('statusRejected') },
  ];

  return (
    <section className="admin-panel">
      <div className="chips admin-status" role="group" aria-label={t('tabOwners')}>
        {views.map((v) => (
          <button key={v.id} type="button" className="chip" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {notice && <p className="form-message" data-kind="ok">{notice}</p>}
      {state === 'error' && <p className="muted">{t('actionError')}</p>}

      {/* ---------- Current owners ---------- */}
      {view === 'owners' && state === 'ready' && owners.length === 0 && <p className="muted">{t('nothingHere')}</p>}
      {view === 'owners' && (
        <ul className="admin-list">
          {owners.map((o) => (
            <li key={o.userId} className="admin-item">
              <div className="admin-item-head">
                <strong>{o.shopName ?? '—'}</strong>
                <span className="role-badge role-owner">{t('ownerBadge')}</span>
                {o.ownerSince && (
                  <span className="muted small">
                    {t('ownerSince')} {shortDate(o.ownerSince)}
                  </span>
                )}
              </div>
              <dl className="facts facts-wrap">
                <div>
                  <dt>{t('email')}</dt>
                  <dd>{o.email}</dd>
                </div>
                <div>
                  <dt>{t('contact')}</dt>
                  <dd>{o.contact ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('reviewerName')}</dt>
                  <dd>
                    <a href={`#user-${o.userId}`}>{animalLabel(o.animal, lang)}</a>
                  </dd>
                </div>
              </dl>
              <p className="small">
                <strong>{t('ownsDeals')}:</strong>{' '}
                {o.deals.length ? o.deals.map((d) => pick(d.name)).join(', ') : t('noLinkedDeal')}
              </p>
              {confirmRemove === o.userId ? (
                <div className="confirm-box">
                  <span className="small">{t('confirmRemoveOwner')}</span>
                  <div className="row-gap">
                    <button type="button" className="btn-danger" onClick={() => remove(o)}>
                      {t('removeOwner')}
                    </button>
                    <button type="button" className="link-btn" onClick={() => setConfirmRemove(null)}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="link-btn" onClick={() => setConfirmRemove(o.userId)}>
                  {t('removeOwner')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------- Applications (pending / rejected) ---------- */}
      {view !== 'owners' && state === 'ready' && applications.length === 0 && <p className="muted">{t('nothingHere')}</p>}
      {view !== 'owners' && (
        <ul className="admin-list">
          {applications.map((item) => {
            const linked = chosenDeal[item.id] ?? item.dealId ?? '';
            return (
              <li key={item.id} className="admin-item">
                <div className="admin-item-head">
                  <strong>{item.shopName}</strong>
                  {item.category && <span className="tag">{t(`cat.${item.category}`)}</span>}
                  <span className="muted small">
                    {t('submittedOn')} {shortDate(item.createdAt)}
                  </span>
                </div>
                {item.offer && <p className="admin-offer">{item.offer}</p>}
                <dl className="facts facts-wrap">
                  <div>
                    <dt>{t('contact')}</dt>
                    <dd>{item.contact}</dd>
                  </div>
                  <div>
                    <dt>{t('area')}</dt>
                    <dd>{item.area || '—'}</dd>
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

                {item.status === 'pending' &&
                  (creatingFor === item.id ? (
                    <DealForm
                      formId={`owner-deal-${item.id}`}
                      initial={{
                        ...emptyDeal(),
                        category: item.category ?? 'food',
                        area: item.area,
                        name: { zh: item.shopName, en: item.shopName },
                        offer: { zh: item.offer, en: item.offer },
                        mapQuery: `淡水 ${item.shopName}`,
                      }}
                      submitLabel={t('createAndApprove')}
                      onSave={async (input) => {
                        const id = await createDeal(input);
                        setCreatingFor(null);
                        await decide(item, 'approved', id);
                      }}
                      onCancel={() => setCreatingFor(null)}
                    />
                  ) : (
                    <>
                      <label className="form-row" htmlFor={`owner-deal-select-${item.id}`}>
                        <span>{t('linkedDeal')}</span>
                        <select
                          id={`owner-deal-select-${item.id}`}
                          className="field"
                          value={linked}
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
                        {linked ? (
                          <button type="button" className="btn-primary" onClick={() => decide(item, 'approved')}>
                            {t('approve')}
                          </button>
                        ) : (
                          <>
                            <button type="button" className="btn-primary" onClick={() => setCreatingFor(item.id)}>
                              {t('createAndApprove')}
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => decide(item, 'approved')}>
                              {t('approveNoDeal')}
                            </button>
                          </>
                        )}
                        <button type="button" className="btn-ghost" onClick={() => decide(item, 'rejected')}>
                          {t('reject')}
                        </button>
                      </div>
                    </>
                  ))}
                {item.status === 'rejected' && (
                  <button type="button" className="link-btn" onClick={() => decide(item, 'pending', item.dealId)}>
                    {t('moveToPending')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
