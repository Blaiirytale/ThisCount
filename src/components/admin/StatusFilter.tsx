// Pending / Approved / Rejected chips

import { useLanguage } from '../../i18n/LanguageContext';
import type { ReviewStatus } from '../../api/admin';

const OPTIONS: { id: ReviewStatus; key: 'statusPending' | 'statusApproved' | 'statusRejected' }[] = [
  { id: 'pending', key: 'statusPending' },
  { id: 'approved', key: 'statusApproved' },
  { id: 'rejected', key: 'statusRejected' },
];

interface Props {
  value: ReviewStatus;
  onChange: (value: ReviewStatus) => void;
}

export function StatusFilter({ value, onChange }: Props) {
  const { t } = useLanguage();
  return (
    <div className="chips admin-status" role="group" aria-label="Status">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {t(o.key)}
        </button>
      ))}
    </div>
  );
}
