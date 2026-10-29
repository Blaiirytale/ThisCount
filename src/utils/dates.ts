// Date helpers

import type { Lang } from '../types';

export function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

// "New this week" = added in the last 7 days
export function isNew(addedAt: string): boolean {
  return daysSince(addedAt) < 7;
}

// Show only YYYY-MM-DD
export function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

// "Thu, 29 Oct" / "10月29日 週四"
export function formatDay(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-TW' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(iso));
}

// "Thu, 29 Oct - Sat, 31 Oct" (or just the start if there's no end)
export function formatRange(start: string, end: string | null | undefined, lang: Lang): string {
  return end ? `${formatDay(start, lang)} - ${formatDay(end, lang)}` : formatDay(start, lang);
}
