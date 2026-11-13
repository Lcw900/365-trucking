-- Run once in your project's SQL Editor. This creates new app tables only.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'customer' check(role in ('customer','driver','admin')),
 status text not null default 'active' check(status in ('active','pending','approved','removed')),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create or replace function public.is_trucking_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and status='active');
$$;
revoke all on function public.is_trucking_admin() from public;
grant execute on function public.is_trucking_admin() to authenticated;
create or replace function public.create_trucking_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name,role,status)
 values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100),
 case when new.raw_user_meta_data->>'requested_role'='driver' then 'driver' else 'customer' end,
 case when new.raw_user_meta_data->>'requested_role'='driver' then 'pending' else 'active' end)
 on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function public.create_trucking_profile() from public;
drop trigger if exists trucking_profile_created on auth.users;
create trigger trucking_profile_created after insert on auth.users for each row execute function public.create_trucking_profile();
-- Backfill users who signed up before this script was run. Never accept admin from metadata.
insert into public.profiles(id,display_name,role,status)
select id,left(coalesce(raw_user_meta_data->>'display_name',''),100),
 case when raw_user_meta_data->>'requested_role'='driver' then 'driver' else 'customer' end,
 case when raw_user_meta_data->>'requested_role'='driver' then 'pending' else 'active' end from auth.users
on conflict(id) do nothing;
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,status) on public.profiles to authenticated;
drop policy if exists trucking_profile_read on public.profiles;
create policy trucking_profile_read on public.profiles for select to authenticated
 using(id=(select auth.uid()) or public.is_trucking_admin());
drop policy if exists trucking_profile_admin_update on public.profiles;
create policy trucking_profile_admin_update on public.profiles for update to authenticated
 using(public.is_trucking_admin()) with check(public.is_trucking_admin());
-- Private buckets for future authenticated media migration. No public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('driver-licenses','driver-licenses',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
drop policy if exists trucking_private_media_read on storage.objects;
create policy trucking_private_media_read on storage.objects for select to authenticated using(
 bucket_id in ('avatars','driver-licenses') and (
 public.is_trucking_admin() or ((storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and status<>'removed'))));
drop policy if exists trucking_private_media_insert on storage.objects;
create policy trucking_private_media_insert on storage.objects for insert to authenticated with check(
 bucket_id in ('avatars','driver-licenses') and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and status<>'removed' and (bucket_id='avatars' or role='driver')));
drop policy if exists trucking_private_media_update on storage.objects;
create policy trucking_private_media_update on storage.objects for update to authenticated using(
 bucket_id in ('avatars','driver-licenses') and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and status<>'removed' and (bucket_id='avatars' or role='driver')))
 with check(bucket_id in ('avatars','driver-licenses') and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and status<>'removed' and (bucket_id='avatars' or role='driver')));
drop policy if exists trucking_private_media_delete on storage.objects;
create policy trucking_private_media_delete on storage.objects for delete to authenticated using(
 bucket_id in ('avatars','driver-licenses') and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and status<>'removed'));
commit;
