-- ThisCount update: profile pictures for everyone (names stay random animals).
-- Paste into Supabase → SQL Editor → Run. Safe to run again.

-- ===================================================================
-- Profile pictures (everyone). Names stay random animals.
-- ===================================================================
alter table public.profiles add column if not exists avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200);

-- Set or clear my picture. Returns the old file path so the website can delete it.
create or replace function public.set_my_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_path text;
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  if p_path is not null and split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'not_allowed';
  end if;
  perform public.ensure_profile(auth.uid());
  select avatar_path into old_path from public.profiles where user_id = auth.uid();
  update public.profiles set avatar_path = p_path where user_id = auth.uid();
  return old_path;
end;
$$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;

-- Admins: remove someone's picture (e.g. inappropriate). Returns the old path.
create or replace function public.admin_remove_avatar(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_path text;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select avatar_path into old_path from public.profiles where user_id = p_user;
  update public.profiles set avatar_path = null where user_id = p_user;
  return old_path;
end;
$$;
revoke all on function public.admin_remove_avatar(uuid) from public, anon;
grant execute on function public.admin_remove_avatar(uuid) to authenticated;

-- Pictures for a list of users (for reviews)
create or replace function public.get_avatars(p_ids uuid[])
returns table (user_id uuid, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.avatar_path
  from public.profiles p
  where p.user_id = any (p_ids[1:200]) and p.avatar_path is not null;
$$;
grant execute on function public.get_avatars(uuid[]) to anon, authenticated;

-- Public profile now includes the picture
drop function if exists public.get_public_profile(uuid);
create or replace function public.get_public_profile(p_user uuid)
returns table (adj text, animal text, tag text, role text, shop_name text, joined_at timestamptz,
               review_count int, is_admin boolean, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.adj, p.animal, p.tag, p.role, p.shop_name, p.created_at,
         (select count(*) from public.reviews r where r.user_id = p.user_id and r.status = 'visible')::int,
         exists (select 1 from public.admins a where a.user_id = p.user_id),
         p.avatar_path
  from public.profiles p
  where p.user_id = p_user;
$$;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- Storage bucket: 2 MB, images only, public to view
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "upload own avatar" on storage.objects;
create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own avatar or admin" on storage.objects;
create policy "delete own avatar or admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Seeing files is needed to delete them (all three photo buckets are public anyway)
drop policy if exists "anyone sees photo files" on storage.objects;
create policy "anyone sees photo files" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('shop-photos', 'review-photos', 'avatars'));
