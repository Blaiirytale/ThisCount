// "new this week" light-blue cards

import { useLanguage } from '../i18n/LanguageContext';
import { formatRange } from '../utils/dates';
import { ClockIcon, PinIcon } from './Icons';
import type { Deal } from '../types';

interface Props {
  deals: Deal[];
  onOpen: (dealId: string) => void;
}

export function NewThisWeek({ deals, onOpen }: Props) {
  const { t, pick, lang } = useLanguage();
  return (
    <section className="new-week" aria-labelledby="new-week-title">
      <h2 id="new-week-title" className="new-week-title">
        {t('newThisWeek')}
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
          </button>
        ))}
      </div>
    </section>
  );
}
