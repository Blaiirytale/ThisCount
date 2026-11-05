-- ThisCount update: admins can add store photos, owners can remove any photo of their deal,
-- and photo files can be deleted properly. Paste into Supabase → SQL Editor → Run. Safe to run again.

-- ===================================================================
-- Admins can add store photos to any deal; owners can remove any photo of their own deal
-- ===================================================================
create or replace function public.before_deal_photo_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin()
    or exists (select 1 from public.deals d where d.id = new.deal_id and d.owner_id = auth.uid())
  ) then
    raise exception 'not_allowed';
  end if;
  if split_part(new.path, '/', 1) <> auth.uid()::text or split_part(new.path, '/', 2) <> new.deal_id then
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

drop policy if exists "owner or admin removes store photos" on public.deal_photos;
create policy "owner or admin removes store photos" on public.deal_photos
  for delete to authenticated using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.deals d where d.id = deal_id and d.owner_id = auth.uid())
  );

drop policy if exists "owners upload store photos" on storage.objects;
create policy "owners upload store photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      public.is_admin()
      or exists (select 1 from public.deals d where d.id = (storage.foldername(name))[2] and d.owner_id = auth.uid())
    )
  );

drop policy if exists "owner or admin deletes store photo files" on storage.objects;
create policy "owner or admin deletes store photo files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (select 1 from public.deals d where d.id = (storage.foldername(name))[2] and d.owner_id = auth.uid())
    )
  );

-- Deleting a file also needs permission to see it. Both photo buckets are public anyway.
drop policy if exists "anyone sees photo files" on storage.objects;
create policy "anyone sees photo files" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('shop-photos', 'review-photos'));
