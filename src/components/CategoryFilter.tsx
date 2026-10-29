// Chips: home, ♥ favorite, food, drink...

import { useLanguage } from '../i18n/LanguageContext';
import { HeartIcon } from './Icons';
import { CATEGORIES, type Filter } from '../types';

interface Props {
  value: Filter;
  onChange: (value: Filter) => void;
}

export function CategoryFilter({ value, onChange }: Props) {
  const { t } = useLanguage();
  const options: { id: Filter; label: string }[] = [
    { id: 'all', label: t('all') },
    { id: 'favorites', label: t('favorites') },
    ...CATEGORIES.map((c) => ({ id: c, label: t(`cat.${c}`) })),
  ];

  return (
    <div className="chips" role="group" aria-label="Category">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="chip"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.id === 'favorites' && <HeartIcon filled />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
