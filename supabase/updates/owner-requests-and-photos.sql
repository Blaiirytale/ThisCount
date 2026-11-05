-- ThisCount update: owner discount requests (2–3 business day approval) + store photos
-- Paste all of this into Supabase → SQL Editor → Run. Safe to run again.

-- ===================================================================
-- Owner discount requests: owners submit new discounts or changes,
-- admins approve (usually within 2–3 business days)
-- ===================================================================
create table if not exists public.owner_deal_requests (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deal_id        text references public.deals (id) on delete set null,   -- the deal to change (null = new discount)
  kind           text not null check (kind in ('new', 'update')),
  category       text not null check (category in ('food', 'drink', 'cafe', 'service', 'fun')),
  area           text not null default '' check (char_length(area) <= 100),
  offer_zh       text not null default '' check (char_length(offer_zh) <= 200),
  offer_en       text not null default '' check (char_length(offer_en) <= 200),
  conditions_zh  text not null default '' check (char_length(conditions_zh) <= 200),
  conditions_en  text not null default '' check (char_length(conditions_en) <= 200),
  valid_until    date,
  note           text not null default '' check (char_length(note) <= 500),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note     text not null default '' check (char_length(admin_note) <= 500),
  result_deal_id text references public.deals (id) on delete set null,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  check (offer_zh <> '' or offer_en <> '')
);
alter table public.owner_deal_requests enable row level security;
create index if not exists owner_deal_requests_status_idx on public.owner_deal_requests (status, created_at);

-- Only approved owners; changes only for their own deals; words checked; max 5 waiting
create or replace function public.before_owner_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'owner') then
    raise exception 'not_owner';
  end if;
  if new.kind = 'update' then
    if not exists (select 1 from public.deals d where d.id = new.deal_id and d.owner_id = auth.uid()) then
      raise exception 'not_allowed';
    end if;
  else
    new.deal_id := null;
  end if;
  if (select count(*) from public.owner_deal_requests r where r.owner_id = auth.uid() and r.status = 'pending') >= 5 then
    raise exception 'too_many_pending';
  end if;
  new.owner_id := auth.uid();
  new.status := 'pending';
  new.admin_note := '';
  new.result_deal_id := null;
  new.decided_at := null;
  new.created_at := now();
  perform public.assert_clean(concat_ws(' ', new.area, new.offer_zh, new.offer_en, new.conditions_zh, new.conditions_en, new.note));
  return new;
end;
$$;
drop trigger if exists owner_requests_before_insert on public.owner_deal_requests;
create trigger owner_requests_before_insert
  before insert on public.owner_deal_requests
  for each row execute function public.before_owner_request_insert();

-- When an admin decides: save the time, and link a newly created deal to the owner
create or replace function public.before_owner_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.decided_at := case when new.status = 'pending' then null else now() end;
  end if;
  if new.status = 'approved' and new.result_deal_id is not null then
    update public.deals set owner_id = new.owner_id where id = new.result_deal_id;
  end if;
  return new;
end;
$$;
drop trigger if exists owner_requests_before_update on public.owner_deal_requests;
create trigger owner_requests_before_update
  before update on public.owner_deal_requests
  for each row execute function public.before_owner_request_update();

drop policy if exists "owners send requests" on public.owner_deal_requests;
create policy "owners send requests" on public.owner_deal_requests
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "read own requests or admin" on public.owner_deal_requests;
create policy "read own requests or admin" on public.owner_deal_requests
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "admins decide requests" on public.owner_deal_requests;
create policy "admins decide requests" on public.owner_deal_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cancel own pending request or admin" on public.owner_deal_requests;
create policy "cancel own pending request or admin" on public.owner_deal_requests
  for delete to authenticated using ((owner_id = auth.uid() and status = 'pending') or public.is_admin());

-- ===================================================================
-- Store photos: shop owners add up to 6 photos per deal.
-- Shown on the site right away (owners are verified); admins can remove any.
-- ===================================================================
create table if not exists public.deal_photos (
  id         bigint generated always as identity primary key,
  deal_id    text not null references public.deals (id) on delete cascade,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path       text not null unique check (char_length(path) <= 200),
  created_at timestamptz not null default now()
);
alter table public.deal_photos enable row level security;
create index if not exists deal_photos_deal_idx on public.deal_photos (deal_id, created_at);

create or replace function public.before_deal_photo_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.deals d where d.id = new.deal_id and d.owner_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;
  if split_part(new.path, '/', 1) <> auth.uid()::text then
    raise exception 'not_allowed';
  end if;
  if (select count(*) from public.deal_photos p where p.deal_id = new.deal_id) >= 6 then
    raise exception 'too_many_photos';
  end if;
  new.owner_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists deal_photos_before_insert on public.deal_photos;
create trigger deal_photos_before_insert
  before insert on public.deal_photos
  for each row execute function public.before_deal_photo_insert();

drop policy if exists "everyone sees store photos" on public.deal_photos;
create policy "everyone sees store photos" on public.deal_photos
  for select to anon, authenticated using (true);

drop policy if exists "owners add store photos" on public.deal_photos;
create policy "owners add store photos" on public.deal_photos
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "owner or admin removes store photos" on public.deal_photos;
create policy "owner or admin removes store photos" on public.deal_photos
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- Storage bucket for the image files (public to view)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-photos', 'shop-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "owners upload store photos" on storage.objects;
create policy "owners upload store photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.deals d where d.id = (storage.foldername(name))[2] and d.owner_id = auth.uid())
  );

drop policy if exists "owner or admin deletes store photo files" on storage.objects;
create policy "owner or admin deletes store photo files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
