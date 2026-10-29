// Heart button: outline = not saved, filled = saved

import { useLanguage } from '../i18n/LanguageContext';
import { HeartIcon } from './Icons';

interface Props {
  active: boolean;
  onClick: () => void;
}

export function FavoriteButton({ active, onClick }: Props) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      className="fav-btn"
      aria-pressed={active}
      aria-label={active ? t('unfavorite') : t('favorite')}
      onClick={(e) => {
        e.stopPropagation(); // don't also open the card
        onClick();
      }}
    >
      <HeartIcon filled={active} />
    </button>
  );
}
