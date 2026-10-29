// Top of the page: round logo, big search box, language + login pills

import type { User } from '@supabase/supabase-js';
import { useLanguage } from '../i18n/LanguageContext';
import { signOut } from '../hooks/useAuth';
import { LanguageToggle } from './LanguageToggle';
import { SearchBar } from './SearchBar';
import { UserIcon } from './Icons';

interface Props {
  user: User | null;
  search: string;
  onSearch: (value: string) => void;
  onLogin: () => void;
  onHome: () => void; // logo click: back to home
}

export function Header({ user, search, onSearch, onLogin, onHome }: Props) {
  const { t } = useLanguage();
  return (
    <header className="site-header container">
      <button type="button" className="logo" onClick={onHome} aria-label="ThisCount home">
        <span>This</span>
        <span>Count</span>
      </button>

      <SearchBar value={search} onChange={onSearch} />

      <div className="header-actions">
        <LanguageToggle />
        <button
          type="button"
          className="pill login-btn"
          onClick={user ? () => signOut() : onLogin}
          title={user?.email}
        >
          <UserIcon />
          <span>{user ? t('logout') : t('login')}</span>
        </button>
      </div>
    </header>
  );
}
