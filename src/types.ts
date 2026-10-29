// Shared data shapes used across the app.

export type Lang = 'zh' | 'en';

// Add a category here, then add "cat.<name>" to i18n/zh.json and en.json
export const CATEGORIES = ['food', 'drink', 'cafe', 'service', 'fun'] as const;
export type Category = (typeof CATEGORIES)[number];

// What the chips can filter by
export type Filter = Category | 'all' | 'favorites';

// Text stored in both languages
export interface Bilingual {
  zh: string;
  en: string;
}

export interface Deal {
  id: string;                 // unique, lowercase, e.g. "sample-bento"
  category: Category;
  area: string;               // e.g. "大學城"
  name: Bilingual;
  offer: Bilingual;
  conditions: Bilingual;
  lastChecked: string;        // YYYY-MM-DD
  addedAt: string;            // ISO date, used for "New this week"
  validUntil?: string | null; // YYYY-MM-DD, optional end date
  ownerId?: string | null;    // approved shop owner's user id
  mapQuery: string;           // text searched on Google Maps
}

// Random name like "Sleepy Otter #42" (keys translated in i18n/animals.ts)
export interface AnimalName {
  adj: string;
  animal: string;
  tag: string;
}

export interface Profile {
  animal: AnimalName;
  nameRerolled: boolean; // true = already used the one 🎲 re-roll
  role: 'student' | 'owner';
  shopName: string | null;
  isAdmin: boolean;
}

export interface ReviewReply {
  id: number;
  body: string;
  authorRole: 'owner' | 'admin';
  authorLabel: string;   // shop name or "ThisCount"
  createdAt: string;
}

export interface Review {
  id: number;
  rating: number;        // 1–5
  worked: boolean | null;
  body: string;
  photoPath: string | null;
  photoUrl: string | null;
  author: AnimalName;
  helpfulCount: number;
  createdAt: string;
  authorId: string;      // links to their public profile
  isMine: boolean;
  isHidden: boolean;     // hidden after reports (only you and admins see it)
  replies: ReviewReply[];
}

// Summary shown on each card
export interface ReviewStats {
  count: number;
  avgRating: number;
  worked: number;
  didnt: number;
  latest: { body: string; author: AnimalName } | null;
}

export type ReviewSort = 'helpful' | 'newest';
export type ReportReason = 'spam' | 'rude' | 'wrong' | 'other';

// What anyone can see about a user
export interface PublicProfile {
  animal: AnimalName;
  role: 'student' | 'owner';
  shopName: string | null;
  joinedAt: string;
  reviewCount: number;
  isAdmin: boolean;
}

// A review shown on a profile page (with the deal it belongs to)
export interface UserReview {
  id: number;
  dealId: string;
  dealName: Bilingual | null;
  rating: number;
  worked: boolean | null;
  body: string;
  photoPath: string | null;
  photoUrl: string | null;
  helpfulCount: number;
  isHidden: boolean;
  createdAt: string;
}
