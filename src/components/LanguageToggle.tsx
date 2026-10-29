// "ENG | 中文" pill

import { useLanguage } from '../i18n/LanguageContext';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="pill lang-toggle" role="group" aria-label="Language">
      <button type="button" className="lang-btn" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        ENG
      </button>
      <span className="lang-sep" aria-hidden="true">|</span>
      <button type="button" className="lang-btn" aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>
        中文
      </button>
    </div>
  );
}
