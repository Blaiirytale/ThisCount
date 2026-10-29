// Language for the whole app. Use: const { t, pick } = useLanguage();

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import zh from './zh.json';
import en from './en.json';
import type { Bilingual, Lang } from '../types';

export type TextKey = keyof typeof zh;

// "satisfies" = TypeScript error if en.json is missing a key that zh.json has
const dict = { zh, en } satisfies Record<Lang, Record<TextKey, string>>;

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TextKey) => string;          // UI text
  pick: (text: Bilingual) => string;    // deal text { zh, en }
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      // storage blocked: fine, just not remembered
    }
  };

  const value: LanguageValue = {
    lang,
    setLang,
    t: (key) => dict[lang][key],
    pick: (text) => text[lang],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return value;
}

function loadLang(): Lang {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}
