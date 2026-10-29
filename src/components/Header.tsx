// Top of the page: round logo, big search box, language, admin, profile/login

import type { User } from '@supabase/supabase-js';
import { useLanguage } from '../i18n/LanguageContext';
import { animalEmoji, animalLabel } from '../i18n/animals';
import { LanguageToggle } from './LanguageToggle';
import { SearchBar } from './SearchBar';
import { UserIcon } from './Icons';
import type { Profile } from '../types';

interface Props {
  user: User | null;
  profile: Profile | null;
  search: string;
  onSearch: (value: string) => void;
  onLogin: () => void;
  onHome: () => void; // logo click: back to home
}

export function Header({ user, profile, search, onSearch, onLogin, onHome }: Props) {
  const { t, lang } = useLanguage();
  return (
    <header className="site-header container">
      <button type="button" className="logo" onClick={onHome} aria-label="ThisCount home">
        <span>This</span>
        <span>Count</span>
      </button>

      <SearchBar value={search} onChange={onSearch} />

      <div className="header-actions">
        <LanguageToggle />
        {profile?.isAdmin && (
          <a className="pill admin-link" href="#admin">
            {t('adminLink')}
          </a>
        )}
        {user ? (
          // Logged in: your animal name, opens your profile
          <a className="pill profile-pill" href="#profile" title={user.email}>
            <span aria-hidden="true">{profile ? animalEmoji(profile.animal) : '🐾'}</span>
            <span>{profile ? animalLabel(profile.animal, lang) : t('profile')}</span>
          </a>
        ) : (
          <button type="button" className="pill login-btn" onClick={onLogin}>
            <UserIcon />
            <span>{t('login')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
