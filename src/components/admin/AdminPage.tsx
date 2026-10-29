// Admin page (open with #admin). Only admins see the content;
// the database also blocks non-admins, so hiding it here is just for looks.

import { useCallback, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { SubmissionsPanel } from './SubmissionsPanel';
import { OwnersPanel } from './OwnersPanel';
import { ReportsPanel } from './ReportsPanel';
import { DealsPanel } from './DealsPanel';
import type { Deal, Profile } from '../../types';

type Tab = 'deals' | 'submissions' | 'owners' | 'reports';

interface Props {
  profile: Profile | null;
  deals: Deal[];
  onDealsChanged: () => void;
  onBack: () => void;
}

export function AdminPage({ profile, deals, onDealsChanged, onBack }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('deals');
  const [counts, setCounts] = useState<Record<Tab, number | null>>({ deals: null, submissions: null, owners: null, reports: null });

  // Panels report their numbers for the tab badges
  const countSubmissions = useCallback((n: number) => setCounts((c) => ({ ...c, submissions: n })), []);
  const countOwners = useCallback((n: number) => setCounts((c) => ({ ...c, owners: n })), []);
  const countReports = useCallback((n: number) => setCounts((c) => ({ ...c, reports: n })), []);

  if (!profile?.isAdmin) {
    return (
      <main className="container admin">
        <p className="empty">{t('adminOnly')}</p>
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← {t('adminBack')}
        </button>
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'deals', label: t('tabDeals') },
    { id: 'submissions', label: t('tabSubmissions') },
    { id: 'owners', label: t('tabOwners') },
    { id: 'reports', label: t('tabReports') },
  ];

  return (
    <main className="container admin">
      <div className="admin-head">
        <h1 className="admin-title">{t('adminTitle')}</h1>
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← {t('adminBack')}
        </button>
      </div>

      <div className="chips admin-tabs" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            className="chip"
            aria-selected={tab === x.id}
            aria-pressed={tab === x.id}
            onClick={() => setTab(x.id)}
          >
            {x.label}
            {!!counts[x.id] && <span className="count-badge">{counts[x.id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'deals' && <DealsPanel onDealsChanged={onDealsChanged} />}
      {tab === 'submissions' && <SubmissionsPanel onDealsChanged={onDealsChanged} onCountChange={countSubmissions} />}
      {tab === 'owners' && <OwnersPanel deals={deals} onDealsChanged={onDealsChanged} onCountChange={countOwners} />}
      {tab === 'reports' && <ReportsPanel onCountChange={countReports} />}
    </main>
  );
}
