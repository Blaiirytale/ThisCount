// "Discount students guide" collage on the home page

import { useLanguage } from '../i18n/LanguageContext';

export function Hero() {
  const { t } = useLanguage();
  return (
    <div className="hero">
      {/* Screen readers read this as "Discount students guide" */}
      <h1 className="hero-art">
        <span className="hero-tape" aria-hidden="true" />
        <span className="hero-discount">Discount</span>
        <span className="hero-students"> students </span>
        <span className="hero-block" aria-hidden="true" />
        <span className="hero-guide">guide</span>
      </h1>
      <p className="hero-tagline">{t('heroTagline')}</p>
    </div>
  );
}
