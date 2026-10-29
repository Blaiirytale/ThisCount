// Turns a student's submission into a real deal (both languages)

import { useLanguage } from '../../i18n/LanguageContext';
import { createDeal, type Submission } from '../../api/admin';
import { DealForm, emptyDeal } from './DealForm';

interface Props {
  submission: Submission;
  onPublished: () => void;
  onCancel: () => void;
}

export function ApproveDealForm({ submission, onPublished, onCancel }: Props) {
  const { t } = useLanguage();

  // Start with the student's text in both languages; the admin translates
  const initial = {
    ...emptyDeal(),
    category: submission.category,
    name: { zh: submission.shop, en: submission.shop },
    offer: { zh: submission.offer, en: submission.offer },
    conditions: { zh: submission.conditions, en: submission.conditions },
    mapQuery: `淡水 ${submission.shop}`,
  };

  return (
    <DealForm
      formId={`submission-${submission.id}`}
      initial={initial}
      submitLabel={t('approveAndPublish')}
      onSave={async (input) => {
        await createDeal(input);
        onPublished();
      }}
      onCancel={onCancel}
    />
  );
}
