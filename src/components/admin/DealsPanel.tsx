// Tab 1: all deals, sorted into groups (trending, new, ending soon...).
// Admins can post a new deal, edit any deal, or hide one.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage, type TextKey } from '../../i18n/LanguageContext';
import { createDeal, listAllDeals, setDealActive, updateDeal, type AdminDeal, type DealInput } from '../../api/admin';
import { loadDealStats, type DealStats } from '../../api/stats';
import { formatRange, isNew } from '../../utils/dates';
import { DealForm, emptyDeal, today } from './DealForm';
import { CATEGORIES, type Category } from '../../types';

type Group = 'all' | 'trending' | 'new' | 'ending' | 'expired' | 'hidden';

const GROUPS: { id: Group; label: TextKey }[] = [
  { id: 'all', label: 'groupAll' },
  { id: 'trending', label: 'groupTrending' },
  { id: 'new', label: 'groupNew' },
  { id: 'ending', label: 'groupEnding' },
  { id: 'expired', label: 'groupExpired' },
  { id: 'hidden', label: 'groupHidden' },
];

const NO_STATS: DealStats = { views: 0, mapClicks: 0, shares: 0, saves: 0, reviews: 0, score: 0 };

// YYYY-MM-DD, n days from today
function daysFromToday(n: number): string {
  const d = new Date(`${today()}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Is this deal in this group?
function inGroup(d: AdminDeal, group: Group, stats: DealStats): boolean {
  const now = today();
  switch (group) {
    case 'all':
      return true;
    case 'trending':
      return d.isActive && stats.score > 0;
    case 'new':
      return d.isActive && isNew(d.addedAt);
    case 'ending':
      return d.isActive && !!d.validUntil && d.validUntil >= now && d.validUntil <= daysFromToday(7);
    case 'expired':
      return !!d.validUntil && d.validUntil < now;
    case 'hidden':
      return !d.isActive;
  }
}

// Deal → form values
function toInput(d: AdminDeal): DealInput {
  return {
    category: d.category,
    area: d.area,
    name: d.name,
    offer: d.offer,
    conditions: d.conditions,
    mapQuery: d.mapQuery,
    validUntil: d.validUntil ?? null,
    lastChecked: d.lastChecked,
    isActive: d.isActive,
  };
}

interface Props {
  onDealsChanged: () => void;
}

export function DealsPanel({ onDealsChanged }: Props) {
  const { t, pick, lang } = useLanguage();
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [stats, setStats] = useState<Record<string, DealStats>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [group, setGroup] = useState<Group>('all');
  const [category, setCategory] = useState<Category | ''>('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null); // deal id, "new", or nothing
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, numbers] = await Promise.all([listAllDeals(), loadDealStats(7, true)]);
      setDeals(list);
      setStats(numbers);
      setState('ready');
    } catch (err) {
      console.error('[ThisCount] all deals', err);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statsOf = (id: string) => stats[id] ?? NO_STATS;

  // How many deals are in each group (for the chip badges)
  const counts = useMemo(() => {
    const c = {} as Record<Group, number>;
    for (const g of GROUPS) c[g.id] = deals.filter((d) => inGroup(d, g.id, statsOf(d.id))).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, stats]);

  // Deals to show: group + category + search. Trending is sorted by score.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = deals.filter(
      (d) =>
        inGroup(d, group, statsOf(d.id)) &&
        (!category || d.category === category) &&
        (!q || [d.name.zh, d.name.en, d.offer.zh, d.offer.en, d.area].join(' ').toLowerCase().includes(q)),
    );
    if (group === 'trending') list.sort((a, b) => statsOf(b.id).score - statsOf(a.id).score);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, stats, group, category, search]);

  // After any change: refresh this list and the public site
  async function saved(message: string) {
    setEditing(null);
    setNotice(message);
    await load();
    onDealsChanged();
  }

  async function toggleActive(deal: AdminDeal) {
    try {
      await setDealActive(deal.id, !deal.isActive);
      await saved(deal.isActive ? t('dealHidden') : t('dealShown'));
    } catch (err) {
      console.error('[ThisCount] setDealActive', err);
      setNotice(t('actionError'));
    }
  }

  return (
    <section className="admin-panel">
      {/* Groups */}
      <div className="chips admin-status" role="group" aria-label={t('tabDeals')}>
        {GROUPS.map((g) => (
          <button key={g.id} type="button" className="chip" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
            {t(g.label)}
            {counts[g.id] > 0 && <span className="count-badge count-quiet">{counts[g.id]}</span>}
          </button>
        ))}
      </div>
      {group === 'trending' && <p className="muted small">{t('trendingHint')}</p>}
      {group === 'expired' && <p className="muted small">{t('expiredHint')}</p>}

      {/* Tools */}
      <div className="row-gap admin-toolbar">
        <button type="button" className="btn-primary" onClick={() => setEditing('new')} disabled={editing === 'new'}>
          + {t('newDeal')}
        </button>
        <select
          id="admin-deal-category"
          className="field admin-select"
          aria-label={t('fieldCategory')}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '')}
        >
          <option value="">{t('allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`cat.${c}`)}
            </option>
          ))}
        </select>
        <input
          id="admin-deal-search"
          className="field"
          type="search"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {notice && <p className="form-message" data-kind="ok">{notice}</p>}

      {editing === 'new' && (
        <div className="admin-item">
          <strong>{t('newDeal')}</strong>
          <DealForm
            formId="new-deal"
            initial={emptyDeal()}
            submitLabel={t('approveAndPublish')}
            onSave={async (input) => {
              await createDeal(input);
              await saved(t('published'));
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {state === 'error' && <p className="muted">{t('actionError')}</p>}
      {state === 'ready' && shown.length === 0 && <p className="muted">{t('nothingHere')}</p>}

      <ul className="admin-list">
        {shown.map((deal, i) => {
          const s = statsOf(deal.id);
          const expired = !!deal.validUntil && deal.validUntil < today();
          return (
            <li key={deal.id} className={deal.isActive ? 'admin-item' : 'admin-item is-inactive'}>
              <div className="admin-item-head">
                {group === 'trending' && <span className="rank">#{i + 1}</span>}
                <strong>{pick(deal.name)}</strong>
                <span className="tag">{t(`cat.${deal.category}`)}</span>
                {!deal.isActive && <span className="tag tag-bad">{t('hiddenStatus')}</span>}
                {deal.isActive && isNew(deal.addedAt) && <span className="badge">{t('new')}</span>}
                {expired && <span className="tag tag-bad">{t('groupExpired')}</span>}
              </div>
              <p className="admin-offer">{pick(deal.offer)}</p>
              <p className="muted small">
                {deal.area} · {formatRange(deal.addedAt, deal.validUntil, lang)} · {t('lastChecked')} {deal.lastChecked}
              </p>
              <p className="stat-line" title={t('last7days')}>
                <span>👁 {s.views} {t('statViews')}</span>
                <span>🗺 {s.mapClicks} {t('statMap')}</span>
                <span>↗ {s.shares} {t('statShares')}</span>
                <span>♥ {s.saves} {t('statSaves')}</span>
                <span>★ {s.reviews} {t('statReviews')}</span>
                <span className="muted">({t('last7days')})</span>
              </p>

              {editing === deal.id ? (
                <DealForm
                  formId={`edit-${deal.id}`}
                  initial={toInput(deal)}
                  submitLabel={t('saveChanges')}
                  showActive
                  onSave={async (input) => {
                    await updateDeal(deal.id, input);
                    await saved(t('changesSaved'));
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="row-gap">
                  <button type="button" className="btn-ghost" onClick={() => setEditing(deal.id)}>
                    ✎ {t('edit')}
                  </button>
                  <button type="button" className="link-btn" onClick={() => toggleActive(deal)}>
                    {deal.isActive ? t('hideFromSite') : t('showOnSite')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
