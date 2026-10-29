// Big boxed search with a magnifier. Filters deals as you type.

import { useLanguage } from '../i18n/LanguageContext';
import { SearchIcon } from './Icons';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const { t } = useLanguage();
  return (
    <label className="search" htmlFor="search">
      <input
        id="search"
        type="search"
        autoComplete="off"
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <SearchIcon className="search-icon" />
    </label>
  );
}
