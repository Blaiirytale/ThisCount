// Tab: discounts and changes sent by shop owners. Promise: decided within 2–3 business days.

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  createDeal,
  listAllDeals,
  listShopOwners,
  updateDeal,
  type AdminDeal,
  type DealInput,
  type ShopOwner,
} from '../../api/admin';
import { decideRequest, listRequests, type DealRequest, type RequestStatus } from '../../api/ownerRequests';
import { approvalWindow, isOverdue } from '../../utils/businessDays';
import { formatDay, shortDate } from '../../utils/dates';
import { DealForm, emptyDeal } from './DealForm';
import { StatusFilter } from './StatusFilter';

interface Props {
  onDealsChanged: () => void;
  onCountChange: (pending: number) => void;
}

// Request + current deal → what the admin sees in the publish form
function formFrom(req: DealRequest, deal: AdminDeal | undefined, shopName: string): DealInput {
  const base: DealInput = deal
    ? {
        category: deal.category,
        area: deal.area,
        name: deal.name,
        offer: deal.offer,
        conditions: deal.conditions,
        mapQuery: deal.mapQuery,
        validUntil: deal.validUntil ?? null,
        lastChecked: deal.lastChecked,
        isActive: deal.isActive,
      }
    : { ...emptyDeal(), name: { zh: shopName, en: shopName }, mapQuery: `淡水 ${shopName}` };
  // Owner's text wins; a missing language falls back to the other one for the admin to translate
  return {
    ...base,
    category: req.category,
    area: req.area || base.area,
    offer: { zh: req.offerZh || req.offerEn, en: req.offerEn || req.offerZh },
    conditions: {
      zh: req.conditionsZh || req.conditionsEn || base.conditions.zh,
      en: req.conditionsEn || req.conditionsZh || base.conditions.en,
    },
    validUntil: req.validUntil ?? base.validUntil,
  };
}

export function OwnerRequestsPanel({ onDealsChanged, onCountChange }: Props) {
  const { t, pick, lang } = useLanguage();
  const [status, setStatus] = useState<RequestStatus>('pending');
  const [items, setItems] = useState<DealRequest[]>([]);
  const [deals, setDeals] = useState<Record<string, AdminDeal>>({});
  const [owners, setOwners] = useState<Record<string, ShopOwner>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [openId, setOpenId] = useState<number | null>(null); // publish form open
  const [rejectId, setRejectId] = useState<number | null>(null); // reject reason box open
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, allDeals, ownerList] = await Promise.all([listRequests(status), listAllDeals(), listShopOwners()]);
      setItems(list);
      setDeals(Object.fromEntries(allDeals.map((d) => [d.id, d])));
      setOwners(Object.fromEntries(ownerList.map((o) => [o.userId, o])));
      if (status === 'pending') onCountChange(list.length);
      setState('ready');
    } catch (err) {
      console.error('[ThisCount] owner requests', err);
      setState('error');
    }
  }, [status, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(req: DealRequest, input: DealInput) {
    let dealId = req.dealId;
    if (req.kind === 'update' && dealId) await updateDeal(dealId, input);
    else dealId = await createDeal(input); // the database links it to the owner
    await decideRequest(req.id, 'approved', '', dealId);
    setOpenId(null);
    setNotice(t('requestApproved'));
    onDealsChanged();
    await load();
  }

  async function reject(req: DealRequest) {
    try {
      await decideRequest(req.id, 'rejected', reason);
      setRejectId(null);
      setReason('');
      setNotice(t('requestRejected'));
      await load();
    } catch (err) {
      console.error('[ThisCount] reject request', err);
      setNotice(t('actionError'));
    }
  }

  return (
    <section className="admin-panel">
      <StatusFilter value={status} onChange={setStatus} />
      {status === 'pending' && <p className="muted small">{t('approvalPromise')}</p>}
      {notice && <p className="form-message" data-kind="ok">{notice}</p>}
      {state === 'error' && <p className="muted">{t('actionError')}</p>}
      {state === 'ready' && items.length === 0 && <p className="muted">{t('nothingHere')}</p>}

      <ul className="admin-list">
        {items.map((req) => {
          const owner = owners[req.ownerId];
          const deal = req.dealId ? deals[req.dealId] : undefined;
          const shopName = owner?.shopName ?? '—';
          const win = approvalWindow(req.createdAt);
          const late = req.status === 'pending' && isOverdue(req.createdAt);
          return (
            <li key={req.id} className="admin-item">
              <div className="admin-item-head">
                <strong>{shopName}</strong>
                <span className="tag">{req.kind === 'new' ? t('requestNew') : t('requestChange')}</span>
                {late && <span className="tag tag-bad">{t('overdue')}</span>}
                <span className="muted small">
                  {t('submittedOn')} {shortDate(req.createdAt)}
                </span>
              </div>
              {req.kind === 'update' && deal && (
                <p className="small">
                  {t('currentDeal')}: <strong>{pick(deal.offer)}</strong> ({pick(deal.name)})
                </p>
              )}
              <p className="admin-offer">
                {req.offerZh}
                {req.offerEn && req.offerEn !== req.offerZh && <span className="muted"> / {req.offerEn}</span>}
              </p>
              <dl className="facts facts-wrap">
                <div>
                  <dt>{t('fieldCategory')}</dt>
                  <dd>{t(`cat.${req.category}`)}</dd>
                </div>
                <div>
                  <dt>{t('area')}</dt>
                  <dd>{req.area || '—'}</dd>
                </div>
                <div>
                  <dt>{t('fieldValidUntil')}</dt>
                  <dd>{req.validUntil ?? '—'}</dd>
                </div>
                {owner && (
                  <div>
                    <dt>{t('contact')}</dt>
                    <dd>
                      {owner.email}
                      {owner.contact ? ` · ${owner.contact}` : ''}
                    </dd>
                  </div>
                )}
              </dl>
              {(req.conditionsZh || req.conditionsEn) && (
                <p className="muted small">
                  {t('fieldConditions')}: {[req.conditionsZh, req.conditionsEn].filter(Boolean).join(' / ')}
                </p>
              )}
              {req.note && (
                <p className="admin-message">
                  <span className="muted small">{t('message')}: </span>
                  {req.note}
                </p>
              )}
              {req.status === 'pending' && (
                <p className="small">
                  {t('decideBy')} {formatDay(win.from.toISOString(), lang)} – {formatDay(win.to.toISOString(), lang)}
                </p>
              )}
              {req.status === 'rejected' && req.adminNote && (
                <p className="small">
                  <strong>{t('adminReason')}:</strong> {req.adminNote}
                </p>
              )}

              {req.status === 'pending' &&
                (openId === req.id ? (
                  <DealForm
                    formId={`request-${req.id}`}
                    initial={formFrom(req, deal, shopName)}
                    submitLabel={t('approveAndPublish')}
                    showActive={req.kind === 'update'}
                    onSave={(input) => approve(req, input)}
                    onCancel={() => setOpenId(null)}
                  />
                ) : rejectId === req.id ? (
                  <div className="confirm-box">
                    <label className="form-row" htmlFor={`reject-${req.id}`}>
                      <span>{t('rejectReason')}</span>
                      <textarea
                        id={`reject-${req.id}`}
                        className="field"
                        rows={2}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <div className="row-gap">
                      <button type="button" className="btn-danger" onClick={() => reject(req)}>
                        {t('reject')}
                      </button>
                      <button type="button" className="link-btn" onClick={() => setRejectId(null)}>
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row-gap">
                    <button type="button" className="btn-primary" onClick={() => setOpenId(req.id)}>
                      {t('reviewAndPublish')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setRejectId(req.id)}>
                      {t('reject')}
                    </button>
                  </div>
                ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
