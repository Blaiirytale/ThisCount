// Light-blue highlight cards on the home page: "trending this week" or "new this week"

import { useLanguage } from '../i18n/LanguageContext';
import { formatRange } from '../utils/dates';
import { ClockIcon, PinIcon } from './Icons';
import type { DealStats } from '../api/stats';
import type { Deal } from '../types';

interface Props {
  title: string;
  deals: Deal[];
  stats?: Record<string, DealStats>; // shows "🔥 12 views" when given
  onOpen: (dealId: string) => void;
}

export function NewThisWeek({ title, deals, stats, onOpen }: Props) {
  const { t, pick, lang } = useLanguage();
  return (
    <section className="new-week" aria-labelledby="new-week-title">
      <h2 id="new-week-title" className="new-week-title">
        {title}
      </h2>
      <div className="new-week-row">
        {deals.map((deal) => (
          <button key={deal.id} type="button" className="nw-card" onClick={() => onOpen(deal.id)}>
            <span className="nw-offer">{pick(deal.offer)}</span>
            <span className="nw-line">
              <PinIcon /> {pick(deal.name)}
            </span>
            <span className="nw-line">
              <ClockIcon /> {formatRange(deal.addedAt, deal.validUntil, lang)}
            </span>
            {stats?.[deal.id] && (
              <span className="nw-line nw-hot">
                🔥 {stats[deal.id].views} {t('statViews')}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
