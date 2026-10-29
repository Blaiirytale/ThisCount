// Animal names for reviewers. Keys must match the lists in supabase/schema.sql.

import type { AnimalName, Bilingual, Lang } from '../types';

const ADJECTIVES: Record<string, Bilingual> = {
  sleepy: { en: 'Sleepy', zh: '愛睡的' },
  hungry: { en: 'Hungry', zh: '肚子餓的' },
  happy: { en: 'Happy', zh: '開心的' },
  brave: { en: 'Brave', zh: '勇敢的' },
  lucky: { en: 'Lucky', zh: '幸運的' },
  curious: { en: 'Curious', zh: '好奇的' },
  sunny: { en: 'Sunny', zh: '陽光的' },
  tiny: { en: 'Tiny', zh: '迷你的' },
  fluffy: { en: 'Fluffy', zh: '毛茸茸的' },
  speedy: { en: 'Speedy', zh: '飛快的' },
  thrifty: { en: 'Thrifty', zh: '精打細算的' },
  chill: { en: 'Chill', zh: '悠哉的' },
};

const ANIMALS: Record<string, { name: Bilingual; emoji: string }> = {
  otter: { name: { en: 'Otter', zh: '水獺' }, emoji: '🦦' },
  leopardcat: { name: { en: 'Leopard Cat', zh: '石虎' }, emoji: '🐆' },
  bear: { name: { en: 'Black Bear', zh: '黑熊' }, emoji: '🐻' },
  magpie: { name: { en: 'Blue Magpie', zh: '藍鵲' }, emoji: '🐦' },
  raccoon: { name: { en: 'Raccoon', zh: '浣熊' }, emoji: '🦝' },
  shiba: { name: { en: 'Shiba', zh: '柴犬' }, emoji: '🐕' },
  cat: { name: { en: 'Cat', zh: '貓咪' }, emoji: '🐈' },
  penguin: { name: { en: 'Penguin', zh: '企鵝' }, emoji: '🐧' },
  seal: { name: { en: 'Seal', zh: '海豹' }, emoji: '🦭' },
  sloth: { name: { en: 'Sloth', zh: '樹懶' }, emoji: '🦥' },
  fox: { name: { en: 'Fox', zh: '狐狸' }, emoji: '🦊' },
  hedgehog: { name: { en: 'Hedgehog', zh: '刺蝟' }, emoji: '🦔' },
  rabbit: { name: { en: 'Rabbit', zh: '兔子' }, emoji: '🐇' },
  panda: { name: { en: 'Panda', zh: '熊貓' }, emoji: '🐼' },
  whale: { name: { en: 'Whale', zh: '鯨魚' }, emoji: '🐳' },
  octopus: { name: { en: 'Octopus', zh: '章魚' }, emoji: '🐙' },
  turtle: { name: { en: 'Turtle', zh: '烏龜' }, emoji: '🐢' },
  frog: { name: { en: 'Frog', zh: '青蛙' }, emoji: '🐸' },
  duck: { name: { en: 'Duck', zh: '鴨子' }, emoji: '🦆' },
  cow: { name: { en: 'Cow', zh: '乳牛' }, emoji: '🐄' },
};

// "Sleepy Otter #42" / "愛睡的水獺 #42"
export function animalLabel(a: AnimalName, lang: Lang): string {
  const adj = ADJECTIVES[a.adj]?.[lang] ?? a.adj;
  const animal = ANIMALS[a.animal]?.name[lang] ?? a.animal;
  return lang === 'zh' ? `${adj}${animal} #${a.tag}` : `${adj} ${animal} #${a.tag}`;
}

export function animalEmoji(a: AnimalName): string {
  return ANIMALS[a.animal]?.emoji ?? '🐾';
}
