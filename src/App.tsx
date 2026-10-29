// The whole page. Holds the data and passes it down to components.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { supabase } from './lib/supabase';
import { loadDeals } from './api/deals';
import { loadReviewStats } from './api/reviews';
import { addFavorite, loadFavorites, removeFavorite } from './api/favorites';
import { isNew } from './utils/dates';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { Hero } from './components/Hero';
import { NewThisWeek } from './components/NewThisWeek';
import { DealCard } from './components/DealCard';
import { DealDetail } from './components/DealDetail';
import { SubmitForm } from './components/SubmitForm';
import { LoginDialog } from './components/LoginDialog';
import { OwnerApplyDialog } from './components/OwnerApplyDialog';
import { Toast } from './components/Toast';
import type { Deal, Filter, ReviewStats } from './types';

// Each view has its own background (see .view-* in components.css)
type View = 'home' | 'favorites' | 'category';

export default function App() {
  const { t, pick } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile } = useProfile(userId);

  // Data
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stats, setStats] = useState<Record<string, ReviewStats>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // UI
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const clearNotice = useCallback(() => setNotice(''), []);

  const view: View = filter === 'all' ? 'home' : filter === 'favorites' ? 'favorites' : 'category';

  const refreshStats = useCallback(() => {
    loadReviewStats().then(setStats).catch((err) => console.error('[ThisCount] stats', err));
  }, []);

  // Load deals once, and review summaries
  useEffect(() => {
    loadDeals()
      .then((d) => {
        setDeals(d);
        setLoadState('ready');
      })
      .catch((err) => {
        console.error('[ThisCount] load', err);
        setLoadState('error');
      });
    refreshStats();
  }, [refreshStats]);

  // Load favorites when someone logs in
  useEffect(() => {
    if (!userId) {
      setFavorites(new Set());
      return;
    }
    loadFavorites().then(setFavorites).catch(console.error);
  }, [userId]);

  // Deals matching search + chip
  const visibleDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (filter === 'favorites' && !favorites.has(d.id)) return false;
      if (filter !== 'all' && filter !== 'favorites' && d.category !== filter) return false;
      if (!q) return true;
      const text = [d.name.zh, d.name.en, d.offer.zh, d.offer.en, d.area].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [deals, search, filter, favorites]);

  const newDeals = useMemo(() => deals.filter((d) => isNew(d.addedAt)), [deals]);
  const showHome = view === 'home' && !search;

  async function toggleFavorite(dealId: string) {
    if (!userId) return setLoginOpen(true);
    const wasFavorite = favorites.has(dealId);
    setFavorites((f) => {
      const next = new Set(f);
      if (wasFavorite) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
    try {
      if (wasFavorite) await removeFavorite(dealId, userId);
      else await addFavorite(dealId, userId);
    } catch (err) {
      console.error('[ThisCount] favorite', err);
      setNotice(t('actionError'));
      loadFavorites().then(setFavorites).catch(console.error);
    }
  }

  // Phone: opens the share sheet. Computer: copies the link.
  async function shareDeal(deal: Deal) {
    const text = `${pick(deal.name)}: ${pick(deal.offer)}`;
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ThisCount', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNotice(t('copied'));
    } catch (err) {
      // Closing the share sheet is not an error
      if ((err as Error).name !== 'AbortError') setNotice(t('actionError'));
    }
  }

  function goHome() {
    setFilter('all');
    setSearch('');
  }

  const openDeal = deals.find((d) => d.id === openDealId) ?? null;

  return (
    <div className={`page view-${view}`}>
      <Header user={user} search={search} onSearch={setSearch} onLogin={() => setLoginOpen(true)} onHome={goHome} />
      {!supabase && <p className="container demo-banner">{t('demoMode')}</p>}

      <nav className="container chips-row" aria-label="Categories">
        <CategoryFilter value={filter} onChange={setFilter} />
      </nav>

      <main className="container">
        {loadState === 'loading' && <p className="empty">{t('loading')}</p>}
        {loadState === 'error' && <p className="empty">{t('loadError')}</p>}
        {loadState === 'ready' && (
          <>
            {showHome && (
              <section className="home-top">
                <Hero />
                {newDeals.length > 0 && <NewThisWeek deals={newDeals} onOpen={setOpenDealId} />}
              </section>
            )}
            <p className="result-count" aria-live="polite">
              {visibleDeals.length} {t('results')}
            </p>
            <div className="deal-grid">
              {visibleDeals.length > 0 ? (
                visibleDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    stats={stats[deal.id]}
                    isFavorite={favorites.has(deal.id)}
                    onOpen={() => setOpenDealId(deal.id)}
                    onToggleFavorite={() => toggleFavorite(deal.id)}
                    onShare={() => shareDeal(deal)}
                  />
                ))
              ) : (
                <p className="empty">{filter === 'favorites' ? t('noFavorites') : t('noResults')}</p>
              )}
            </div>
          </>
        )}
        {view === 'home' && <SubmitForm userId={userId} onLogin={() => setLoginOpen(true)} />}
      </main>

      <footer className="container site-footer">
        <button type="button" className="btn-ghost owner-cta" onClick={() => setOwnerOpen(true)}>
          🏪 {t('ownerCta')}
        </button>
        <p>{t('footer')}</p>
      </footer>

      <DealDetail
        deal={openDeal}
        stats={openDeal ? stats[openDeal.id] : undefined}
        isFavorite={openDeal ? favorites.has(openDeal.id) : false}
        userId={userId}
        profile={profile}
        onClose={() => setOpenDealId(null)}
        onToggleFavorite={() => openDeal && toggleFavorite(openDeal.id)}
        onLogin={() => setLoginOpen(true)}
        onReviewsChanged={refreshStats}
      />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <OwnerApplyDialog
        open={ownerOpen}
        onClose={() => setOwnerOpen(false)}
        userId={userId}
        profile={profile}
        deals={deals}
        onLogin={() => {
          setOwnerOpen(false);
          setLoginOpen(true);
        }}
      />
      <Toast message={notice} onDone={clearNotice} />
    </div>
  );
}
