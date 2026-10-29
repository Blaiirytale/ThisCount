-- ThisCount database setup.
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to run again.
--
-- Who can do what (enforced by the database, not the website code):
--   Everyone:        read active deals, visible reviews and replies
--   Logged-in users: review (1 per deal), mark helpful, report, favorite, submit deals, apply as owner
--   Shop owners:     reply to reviews of their own shop (after admin approval)
--   Admins:          edit deals, approve owners, reply anywhere, hide/unhide reviews

-- ===================================================================
-- Admins
-- ===================================================================
create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins see admins" on public.admins;
create policy "admins see admins" on public.admins
  for select to authenticated using (public.is_admin());

-- ===================================================================
-- Bad-word filter
-- Checked inside the database, so nobody can skip it by changing the website.
-- Text is normalized first: lowercase, full-width → normal, 0→o 1→i 3→e 4→a 5→s 7→t 8→b @→a $→s,
-- then spaces/dots/symbols are removed. Each letter may repeat ("fuuuck").
-- Admins add words in Table Editor → blocked_words.
-- ===================================================================
create table if not exists public.blocked_words (
  term text primary key
);
alter table public.blocked_words enable row level security; -- no policies: only the database reads it

create or replace function public.normalize_text(t text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(normalize(coalesce(t, ''), NFKC)), '0134578@$!|', 'oieastbasii'),
    '[^a-z一-鿿]', '', 'g'
  );
$$;

create or replace function public.contains_blocked_word(t text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocked_words b
    where public.normalize_text(t) ~ regexp_replace(public.normalize_text(b.term), '(.)', '\1+', 'g')
  );
$$;

create or replace function public.assert_clean(t text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if t is not null and t <> '' and public.contains_blocked_word(t) then
    raise exception 'blocked_language' using hint = 'The text contains words that are not allowed.';
  end if;
end;
$$;

insert into public.blocked_words (term) values
  -- English (swearing, slurs, sexual)
  ('fuck'), ('fck'), ('fuq'), ('phuck'), ('shit'), ('bitch'), ('btch'), ('biatch'), ('cunt'),
  ('asshole'), ('bastard'), ('whore'), ('slut'), ('nigger'), ('nigga'), ('faggot'), ('retard'),
  ('dickhead'), ('pussy'), ('porn'), ('wanker'), ('twat'), ('jerkoff'),
  -- 中文（髒話、歧視、色情）
  ('幹你'), ('幹妳'), ('幹林'), ('幹拎'), ('姦你'), ('靠北'), ('靠杯'), ('靠夭'), ('機掰'), ('雞掰'),
  ('機巴'), ('雞巴'), ('雞歪'), ('機歪'), ('白痴'), ('白癡'), ('智障'), ('低能兒'), ('腦殘'), ('王八蛋'),
  ('他媽的'), ('操你'), ('肏'), ('屌你'), ('婊子'), ('賤人'), ('去死'), ('懶叫'), ('懶趴'), ('做愛'),
  ('打砲'), ('約砲'), ('傻逼'), ('傻b'), ('草泥馬'), ('草泥马')
on conflict (term) do nothing;

-- ===================================================================
-- Profiles: every user gets a random animal name, e.g. "Sleepy Otter #42"
-- (the words are translated on the website from these keys)
-- ===================================================================
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  adj        text not null,
  animal     text not null,
  tag        text not null,
  role       text not null default 'student' check (role in ('student', 'owner')),
  shop_name  text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Allowed name words. Keep these lists in sync with src/i18n/animals.ts
create or replace function public.allowed_adjs() returns text[] language sql immutable as $$
  select array['sleepy','hungry','happy','brave','lucky','curious','sunny','tiny','fluffy','speedy','thrifty','chill'];
$$;
create or replace function public.allowed_animals() returns text[] language sql immutable as $$
  select array['otter','leopardcat','bear','magpie','raccoon','shiba','cat','penguin','seal','sloth','fox',
               'hedgehog','rabbit','panda','whale','octopus','turtle','frog','duck','cow'];
$$;
create or replace function public.random_adj() returns text language sql volatile as $$
  select a[1 + floor(random() * array_length(a, 1))::int] from (select public.allowed_adjs() as a) x;
$$;
create or replace function public.random_animal() returns text language sql volatile as $$
  select a[1 + floor(random() * array_length(a, 1))::int] from (select public.allowed_animals() as a) x;
$$;
create or replace function public.random_tag() returns text language sql volatile as $$
  select lpad(floor(random() * 100)::int::text, 2, '0');
$$;

create or replace function public.ensure_profile(uid uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where user_id = uid;
  if not found then
    insert into public.profiles (user_id, adj, animal, tag)
    values (uid, public.random_adj(), public.random_animal(), public.random_tag())
    on conflict (user_id) do nothing;
    select * into p from public.profiles where user_id = uid;
  end if;
  return p;
end;
$$;
revoke all on function public.ensure_profile(uuid) from public, anon, authenticated;

-- Called by the website right after login (also fixes users created before this script)
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  perform public.ensure_profile(auth.uid());
end;
$$;
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- New sign-up → new animal name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_profile(new.id);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Today's date in Taiwan (used to hide expired deals automatically)
create or replace function public.today_tw()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Taipei')::date;
$$;

-- ===================================================================
-- Deals (admins edit these; owner_id links a deal to its approved shop owner)
-- ===================================================================
create table if not exists public.deals (
  id            text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  category      text not null check (category in ('food', 'drink', 'cafe', 'service', 'fun')),
  area          text not null,
  name_zh       text not null,
  name_en       text not null,
  offer_zh      text not null,
  offer_en      text not null,
  conditions_zh text not null default '',
  conditions_en text not null default '',
  map_query     text not null default '',
  last_checked  date not null default current_date,
  added_at      timestamptz not null default now(),
  valid_until   date,
  owner_id      uuid references auth.users (id) on delete set null,
  is_active     boolean not null default true
);
alter table public.deals add column if not exists valid_until date;
alter table public.deals add column if not exists owner_id uuid references auth.users (id) on delete set null;
alter table public.deals enable row level security;

drop policy if exists "everyone reads active deals" on public.deals;
-- Visitors see deals that are shown AND not expired. Admins see everything.
create policy "everyone reads active deals" on public.deals
  for select to anon, authenticated
  using ((is_active and (valid_until is null or valid_until >= public.today_tw())) or public.is_admin());

drop policy if exists "admins manage deals" on public.deals;
create policy "admins manage deals" on public.deals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===================================================================
-- Favorites
-- ===================================================================
create table if not exists public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deal_id    text not null references public.deals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deal_id)
);
alter table public.favorites enable row level security;

drop policy if exists "manage own favorites" on public.favorites;
create policy "manage own favorites" on public.favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===================================================================
-- Reviews: stars + worked/didn't + text + optional photo. One per user per deal.
-- ===================================================================
create table if not exists public.reviews (
  id            bigint generated always as identity primary key,
  deal_id       text not null references public.deals (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating        int not null check (rating between 1 and 5),
  worked        boolean,
  body          text not null default '' check (char_length(body) <= 500),
  photo_path    text check (photo_path is null or char_length(photo_path) <= 200),
  author_adj    text not null default '',
  author_animal text not null default '',
  author_tag    text not null default '',
  helpful_count int not null default 0,
  report_count  int not null default 0,
  status        text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at    timestamptz not null default now(),
  unique (deal_id, user_id)
);
alter table public.reviews enable row level security;
create index if not exists reviews_deal_idx on public.reviews (deal_id, status, helpful_count desc, created_at desc);

-- Before saving: fill in the animal name, check words, reset counters (users can't fake them)
create or replace function public.before_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  p := public.ensure_profile(auth.uid());
  new.user_id := auth.uid();
  new.author_adj := p.adj;
  new.author_animal := p.animal;
  new.author_tag := p.tag;
  new.body := btrim(coalesce(new.body, ''));
  perform public.assert_clean(new.body);
  if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'not_allowed';
  end if;
  new.helpful_count := 0;
  new.report_count := 0;
  new.status := 'visible';
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists reviews_before_insert on public.reviews;
create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function public.before_review_insert();

drop policy if exists "read visible reviews" on public.reviews;
create policy "read visible reviews" on public.reviews
  for select to anon, authenticated
  using (status = 'visible' or user_id = auth.uid() or public.is_admin());

drop policy if exists "write own review" on public.reviews;
create policy "write own review" on public.reviews
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "delete own review or admin" on public.reviews;
create policy "delete own review or admin" on public.reviews
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins update reviews" on public.reviews;
create policy "admins update reviews" on public.reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Summary per deal for the cards (average stars, counts, newest written review)
create or replace function public.get_review_stats()
returns table (
  deal_id text, review_count int, avg_rating numeric, worked int, didnt int,
  latest_body text, latest_adj text, latest_animal text, latest_tag text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.deal_id,
         count(*)::int,
         round(avg(r.rating)::numeric, 1),
         (count(*) filter (where r.worked = true))::int,
         (count(*) filter (where r.worked = false))::int,
         (array_agg(r.body order by r.created_at desc) filter (where r.body <> ''))[1],
         (array_agg(r.author_adj order by r.created_at desc) filter (where r.body <> ''))[1],
         (array_agg(r.author_animal order by r.created_at desc) filter (where r.body <> ''))[1],
         (array_agg(r.author_tag order by r.created_at desc) filter (where r.body <> ''))[1]
  from public.reviews r
  where r.status = 'visible'
  group by r.deal_id;
$$;
grant execute on function public.get_review_stats() to anon, authenticated;

-- ===================================================================
-- "Helpful" marks
-- ===================================================================
create table if not exists public.review_helpful (
  review_id  bigint not null references public.reviews (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_helpful enable row level security;

drop policy if exists "manage own helpful" on public.review_helpful;
create policy "manage own helpful" on public.review_helpful
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.on_helpful_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
    return new;
  end if;
  update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  return old;
end;
$$;
drop trigger if exists review_helpful_count on public.review_helpful;
create trigger review_helpful_count
  after insert or delete on public.review_helpful
  for each row execute function public.on_helpful_change();

-- ===================================================================
-- Reports: 3 reports hide a review until an admin checks it
-- (Admins: Table Editor → reviews → set status back to 'visible')
-- ===================================================================
create table if not exists public.review_reports (
  review_id  bigint not null references public.reviews (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason     text not null default 'other' check (reason in ('spam', 'rude', 'wrong', 'other')),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_reports enable row level security;

drop policy if exists "users report" on public.review_reports;
create policy "users report" on public.review_reports
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "admins read reports" on public.review_reports;
create policy "admins read reports" on public.review_reports
  for select to authenticated using (public.is_admin());

create or replace function public.on_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reviews
     set report_count = report_count + 1,
         status = case when report_count + 1 >= 3 then 'hidden' else status end
   where id = new.review_id;
  return new;
end;
$$;
drop trigger if exists review_reported on public.review_reports;
create trigger review_reported
  after insert on public.review_reports
  for each row execute function public.on_report();

-- ===================================================================
-- Replies from shop owners and admins
-- ===================================================================
create table if not exists public.review_replies (
  id           bigint generated always as identity primary key,
  review_id    bigint not null references public.reviews (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_role  text not null default 'owner' check (author_role in ('owner', 'admin')),
  author_label text not null default '',
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now()
);
alter table public.review_replies enable row level security;

create or replace function public.before_reply_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_shop  text;
begin
  new.user_id := auth.uid();
  new.body := btrim(coalesce(new.body, ''));
  perform public.assert_clean(new.body);
  new.created_at := now();

  if public.is_admin() then
    new.author_role := 'admin';
    new.author_label := 'ThisCount';
    return new;
  end if;

  select d.owner_id into v_owner
  from public.reviews r join public.deals d on d.id = r.deal_id
  where r.id = new.review_id;
  if v_owner is distinct from auth.uid() then
    raise exception 'not_allowed';
  end if;

  select p.shop_name into v_shop from public.profiles p where p.user_id = auth.uid();
  new.author_role := 'owner';
  new.author_label := coalesce(v_shop, 'Shop owner');
  return new;
end;
$$;
drop trigger if exists replies_before_insert on public.review_replies;
create trigger replies_before_insert
  before insert on public.review_replies
  for each row execute function public.before_reply_insert();

drop policy if exists "everyone reads replies" on public.review_replies;
create policy "everyone reads replies" on public.review_replies
  for select to anon, authenticated using (true);

drop policy if exists "owners and admins reply" on public.review_replies;
create policy "owners and admins reply" on public.review_replies
  for insert to authenticated with check (
    user_id = auth.uid() and (
      public.is_admin() or exists (
        select 1 from public.reviews r join public.deals d on d.id = r.deal_id
        where r.id = review_id and d.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "delete own reply or admin" on public.review_replies;
create policy "delete own reply or admin" on public.review_replies
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ===================================================================
-- Shop owner applications
-- Admin approves: Table Editor → owner_applications → set status to 'approved'.
-- If deal_id is filled in, that deal is linked to the owner automatically.
-- ===================================================================
create table if not exists public.owner_applications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shop_name  text not null check (char_length(shop_name) between 1 and 100),
  contact    text not null check (char_length(contact) between 1 and 100),
  deal_id    text references public.deals (id) on delete set null,
  message    text not null default '' check (char_length(message) <= 500),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.owner_applications enable row level security;

create or replace function public.before_owner_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  perform public.assert_clean(new.shop_name || ' ' || coalesce(new.message, ''));
  return new;
end;
$$;
drop trigger if exists owner_applications_before_insert on public.owner_applications;
create trigger owner_applications_before_insert
  before insert on public.owner_applications
  for each row execute function public.before_owner_application_insert();

create or replace function public.on_owner_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.ensure_profile(new.user_id);
    update public.profiles set role = 'owner', shop_name = new.shop_name where user_id = new.user_id;
    if new.deal_id is not null then
      update public.deals set owner_id = new.user_id where id = new.deal_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists owner_applications_after_update on public.owner_applications;
create trigger owner_applications_after_update
  after update on public.owner_applications
  for each row execute function public.on_owner_application_update();

drop policy if exists "users apply" on public.owner_applications;
create policy "users apply" on public.owner_applications
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "read own application or admin" on public.owner_applications;
create policy "read own application or admin" on public.owner_applications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins decide applications" on public.owner_applications;
create policy "admins decide applications" on public.owner_applications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===================================================================
-- Submissions (new deals from students, waiting for review)
-- ===================================================================
create table if not exists public.submissions (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  shop       text not null check (char_length(shop) between 1 and 100),
  category   text not null check (category in ('food', 'drink', 'cafe', 'service', 'fun')),
  offer      text not null check (char_length(offer) between 1 and 200),
  conditions text not null default '' check (char_length(conditions) <= 200),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.submissions enable row level security;

create or replace function public.before_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_clean(new.shop || ' ' || new.offer || ' ' || coalesce(new.conditions, ''));
  return new;
end;
$$;
drop trigger if exists submissions_before_insert on public.submissions;
create trigger submissions_before_insert
  before insert on public.submissions
  for each row execute function public.before_submission_insert();

drop policy if exists "users submit deals" on public.submissions;
create policy "users submit deals" on public.submissions
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "admins read submissions" on public.submissions;
create policy "admins read submissions" on public.submissions
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update submissions" on public.submissions;
create policy "admins update submissions" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===================================================================
-- Review photos (Storage). Public to view; users upload only into their own folder.
-- If this part errors, create a public bucket named "review-photos" in Storage instead.
-- ===================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "upload own review photos" on storage.objects;
create policy "upload own review photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own review photos" on storage.objects;
create policy "delete own review photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================================================================
-- Sample deals (delete when you add real ones)
-- ===================================================================
insert into public.deals
  (id, category, area, name_zh, name_en, offer_zh, offer_en, conditions_zh, conditions_en, map_query, added_at, valid_until)
values
  ('sample-bento', 'food', '大學城', '範例便當屋', 'Sample Bento House', '學生 9 折', '10% off',
   '出示學生證，平日 11:00–14:00', 'Show student ID, weekdays 11:00–14:00', '淡水 大學城', now() - interval '2 days', current_date + 7),
  ('sample-tea', 'drink', '水源街', '範例手搖飲', 'Sample Tea Stand', '大杯升級免費', 'Free size upgrade',
   '出示學生證', 'Show student ID', '淡水 水源街', now() - interval '3 days', current_date + 3),
  ('sample-study-cafe', 'cafe', '英專路', '範例讀書咖啡', 'Sample Study Café', '學生平日不限時', 'No time limit on weekdays',
   '低消 NT$80', 'Min. spend NT$80', '淡水 英專路', now() - interval '17 days', null),
  ('sample-print', 'service', '大學城', '範例影印店', 'Sample Print Shop', '黑白影印 NT$0.8/張', 'B&W print NT$0.8/page',
   '學生證，50 張以上', 'Student ID, 50+ pages', '淡水 大學城', now() - interval '24 days', null)
on conflict (id) do nothing;

-- ===================================================================
-- Make yourself an admin
-- 1. Log in on the website once with your email.
-- 2. Change the email below, remove the "--", and run this line:
-- insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
-- ===================================================================

-- ===================================================================
-- Review translations (saved so each review is translated only once)
-- Written only by the "translate-review" Edge Function (server side).
-- ===================================================================
create table if not exists public.review_translations (
  review_id       bigint not null references public.reviews (id) on delete cascade,
  target_lang     text not null check (target_lang in ('zh', 'en')),
  translated_text text not null,
  source_lang     text not null default '',
  created_at      timestamptz not null default now(),
  primary key (review_id, target_lang)
);
alter table public.review_translations enable row level security;

drop policy if exists "everyone reads translations" on public.review_translations;
create policy "everyone reads translations" on public.review_translations
  for select to anon, authenticated using (true);
-- No insert policy: visitors can't write fake translations.

-- ===================================================================
-- Admin page extras
-- ===================================================================
-- Admins can clear reports when they restore a review
drop policy if exists "admins delete reports" on public.review_reports;
create policy "admins delete reports" on public.review_reports
  for delete to authenticated using (public.is_admin());

-- Admins can remove photos of reviews they delete
drop policy if exists "admins delete review photos" on storage.objects;
create policy "admins delete review photos" on storage.objects
  for delete to authenticated using (bucket_id = 'review-photos' and public.is_admin());

-- ===================================================================
-- Profiles: pick your own animal name, and public profiles
-- ===================================================================
-- Change my name. Only words from the lists are allowed, so no bad names.
-- Also updates the name on my old reviews.
create or replace function public.set_my_animal(p_adj text, p_animal text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  if not (p_adj = any (public.allowed_adjs())) or not (p_animal = any (public.allowed_animals())) then
    raise exception 'invalid_name';
  end if;
  perform public.ensure_profile(auth.uid());
  update public.profiles set adj = p_adj, animal = p_animal where user_id = auth.uid();
  update public.reviews set author_adj = p_adj, author_animal = p_animal where user_id = auth.uid();
end;
$$;
-- Only used by reroll_my_animal() below; the website can't pick names directly
revoke all on function public.set_my_animal(text, text) from public, anon, authenticated;

-- Get a new random name (the website's 🎲 button). Allowed ONCE per person.
-- Admins can unlock it: Table Editor → profiles → set name_rerolled to false.
alter table public.profiles add column if not exists name_rerolled boolean not null default false;

create or replace function public.reroll_my_animal()
returns table (adj text, animal text, tag text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj text := public.random_adj();
  v_animal text := public.random_animal();
begin
  if exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.name_rerolled) then
    raise exception 'reroll_used';
  end if;
  perform public.set_my_animal(v_adj, v_animal);
  update public.profiles set name_rerolled = true where user_id = auth.uid();
  return query select p.adj, p.animal, p.tag from public.profiles p where p.user_id = auth.uid();
end;
$$;
revoke all on function public.reroll_my_animal() from public, anon;
grant execute on function public.reroll_my_animal() to authenticated;

-- Which accounts are admins (so the website can show an "Admin" badge)
create or replace function public.get_admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.admins;
$$;
grant execute on function public.get_admin_ids() to anon, authenticated;

-- What anyone can see about a user (no email)
drop function if exists public.get_public_profile(uuid);
create or replace function public.get_public_profile(p_user uuid)
returns table (adj text, animal text, tag text, role text, shop_name text, joined_at timestamptz, review_count int, is_admin boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.adj, p.animal, p.tag, p.role, p.shop_name, p.created_at,
         (select count(*) from public.reviews r where r.user_id = p.user_id and r.status = 'visible')::int,
         exists (select 1 from public.admins a where a.user_id = p.user_id)
  from public.profiles p
  where p.user_id = p_user;
$$;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- ===================================================================
-- Trending: count views, map clicks and shares per deal
-- Each browser counts once per deal, per kind, per day (no spam inflation).
-- ===================================================================
create table if not exists public.deal_events (
  id         bigint generated always as identity primary key,
  deal_id    text not null references public.deals (id) on delete cascade,
  kind       text not null check (kind in ('view', 'map', 'share')),
  visitor_id uuid not null,
  day        date not null default ((now() at time zone 'Asia/Taipei')::date),
  created_at timestamptz not null default now(),
  unique (deal_id, kind, visitor_id, day)
);
alter table public.deal_events enable row level security; -- no policies: only the functions below touch it
create index if not exists deal_events_recent_idx on public.deal_events (created_at, deal_id);

create or replace function public.track_deal(p_deal_id text, p_kind text, p_visitor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('view', 'map', 'share') or p_visitor is null then
    return;
  end if;
  insert into public.deal_events (deal_id, kind, visitor_id)
  select d.id, p_kind, p_visitor from public.deals d
  where d.id = p_deal_id and d.is_active and (d.valid_until is null or d.valid_until >= public.today_tw())
  on conflict do nothing;
end;
$$;
grant execute on function public.track_deal(text, text, uuid) to anon, authenticated;

-- Numbers per deal for the last p_days days.
-- score = views + 2×map clicks + 2×shares + 3×saves + 5×reviews
-- p_all = true includes hidden deals, but only for admins.
drop function if exists public.get_deal_stats(int, boolean);
create or replace function public.get_deal_stats(p_days int default 7, p_all boolean default false)
returns table (deal_id text, views int, map_clicks int, shares int, saves int, reviews int, score int)
language sql
stable
security definer
set search_path = public
as $$
  with since as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90)) as t
  ),
  e as (
    select ev.deal_id,
           count(*) filter (where ev.kind = 'view')  as views,
           count(*) filter (where ev.kind = 'map')   as map_clicks,
           count(*) filter (where ev.kind = 'share') as shares
    from public.deal_events ev, since
    where ev.created_at >= since.t
    group by ev.deal_id
  ),
  f as (
    select fa.deal_id, count(*) as saves
    from public.favorites fa, since
    where fa.created_at >= since.t
    group by fa.deal_id
  ),
  r as (
    select rv.deal_id, count(*) as reviews
    from public.reviews rv, since
    where rv.status = 'visible' and rv.created_at >= since.t
    group by rv.deal_id
  )
  select d.id,
         coalesce(e.views, 0)::int,
         coalesce(e.map_clicks, 0)::int,
         coalesce(e.shares, 0)::int,
         coalesce(f.saves, 0)::int,
         coalesce(r.reviews, 0)::int,
         (coalesce(e.views, 0) + 2 * coalesce(e.map_clicks, 0) + 2 * coalesce(e.shares, 0)
          + 3 * coalesce(f.saves, 0) + 5 * coalesce(r.reviews, 0))::int
  from public.deals d
  left join e on e.deal_id = d.id
  left join f on f.deal_id = d.id
  left join r on r.deal_id = d.id
  where (d.is_active and (d.valid_until is null or d.valid_until >= public.today_tw()))
     or (p_all and public.is_admin());
$$;
grant execute on function public.get_deal_stats(int, boolean) to anon, authenticated;
