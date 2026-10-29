# ThisCount_studentdeal

Student deals near Tamkang University, in Chinese and English.
淡江周邊學生優惠，一次看完。

## Features
- Search, category chips and "New this week"
- 中文 / English switch
- Email login with magic links (any email, no password)
- "Still works / Gone" votes, favorites ♥, comments
- Submit-a-deal form; admins review and publish

## Tech stack
- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (Postgres, Auth, row-level security)
- **Hosting:** GitHub Pages via GitHub Actions

## Run locally
```bash
npm install
cp .env.example .env   # add your Supabase URL + anon key
npm run dev
```
Without Supabase keys the site runs read-only from `public/data/deals.json`.

## Project structure
```
src/App.tsx            page layout + app data
src/components/        UI pieces (DealCard, DealDetail, CommentList...)
src/api/               database calls (deals, votes, favorites, comments, submissions)
src/hooks/useAuth.ts   login state
src/i18n/              Chinese and English text
src/styles/            design tokens and styles
supabase/schema.sql    tables and security rules
```

## Admin: add or edit a deal
Supabase → Table Editor → `deals`. New rows appear on the site right away.
Review student submissions in the `submissions` table.
