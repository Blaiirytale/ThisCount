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
import { loadDealStats, trackDeal, type DealStats } from './api/stats';
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
import { AdminPage } from './components/admin/AdminPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { PublicProfilePage } from './components/profile/PublicProfilePage';
import type { Deal, Filter, ReviewStats } from './types';

// Each view has its own background (see .view-* in components.css)
type View = 'home' | 'favorites' | 'category';

export default function App() {
  const { t, pick } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile, reload: reloadProfile } = useProfile(userId);

  // Data
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stats, setStats] = useState<Record<string, ReviewStats>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [dealStats, setDealStats] = useState<Record<string, DealStats>>({});

  // UI
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const clearNotice = useCallback(() => setNotice(''), []);

  // "#admin" in the address opens the admin page
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const isAdminRoute = route === '#admin';
  const isProfileRoute = route === '#profile';
  const publicUserId = route.startsWith('#user-') ? route.slice('#user-'.length) : null;
  const pageView = isAdminRoute || isProfileRoute || publicUserId ? 'admin' : null; // plain cream background

  // Following a link (e.g. a reviewer's name) closes the deal pop-up
  useEffect(() => {
    setOpenDealId(null);
    window.scrollTo(0, 0);
  }, [route]);

  const view: View = filter === 'all' ? 'home' : filter === 'favorites' ? 'favorites' : 'category';

  const refreshStats = useCallback(() => {
    loadReviewStats().then(setStats).catch((err) => console.error('[ThisCount] stats', err));
  }, []);

  // Load deals (again after an admin publishes one)
  const reloadDeals = useCallback(() => {
    loadDeals()
      .then((d) => {
        setDeals(d);
        setLoadState('ready');
      })
      .catch((err) => {
        console.error('[ThisCount] load', err);
        setLoadState('error');
      });
  }, []);

  useEffect(() => {
    reloadDeals();
    refreshStats();
    loadDealStats(7).then(setDealStats).catch((err) => console.error('[ThisCount] deal stats', err));
  }, [reloadDeals, refreshStats]);

  // Count a view whenever a deal is opened (once per day per browser)
  useEffect(() => {
    if (openDealId) trackDeal(openDealId, 'view');
  }, [openDealId]);

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

  // Top deals by score this week. Until there's enough data, show "new this week" instead.
  const trendingDeals = useMemo(
    () =>
      deals
        .filter((d) => (dealStats[d.id]?.score ?? 0) > 0)
        .sort((a, b) => dealStats[b.id].score - dealStats[a.id].score)
        .slice(0, 6),
    [deals, dealStats],
  );
  const showTrending = trendingDeals.length >= 3;
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
    trackDeal(deal.id, 'share');
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
    if (window.location.hash) {
      // Remove "#admin" / "#profile" from the address without reloading
      history.pushState('', document.title, window.location.pathname + window.location.search);
      setRoute('');
    }
  }

  // Typing in search on another page jumps back to the deals
  function handleSearch(value: string) {
    if (route) goHome();
    setSearch(value);
  }

  const openDeal = deals.find((d) => d.id === openDealId) ?? null;

  return (
    <div className={`page view-${pageView ?? view}`}>
      <Header
        user={user}
        profile={profile}
        search={search}
        onSearch={handleSearch}
        onLogin={() => setLoginOpen(true)}
        onHome={goHome}
      />
      {!supabase && <p className="container demo-banner">{t('demoMode')}</p>}

      {isAdminRoute ? (
        <AdminPage profile={profile} deals={deals} onDealsChanged={reloadDeals} onBack={goHome} />
      ) : isProfileRoute ? (
        <ProfilePage
          userId={userId}
          profile={profile}
          onProfileChanged={reloadProfile}
          onReviewsChanged={refreshStats}
          onOpenDeal={setOpenDealId}
          onLogin={() => setLoginOpen(true)}
          onBack={goHome}
        />
      ) : publicUserId ? (
        <PublicProfilePage userId={publicUserId} onOpenDeal={setOpenDealId} onBack={goHome} />
      ) : (
        <>
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
                  {showTrending ? (
                    <NewThisWeek title={t('trendingThisWeek')} deals={trendingDeals} stats={dealStats} onOpen={setOpenDealId} />
                  ) : (
                    newDeals.length > 0 && <NewThisWeek title={t('newThisWeek')} deals={newDeals} onOpen={setOpenDealId} />
                  )}
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

        </>
      )}

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
