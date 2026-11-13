begin;
create schema if not exists trucking_private;
revoke all on schema trucking_private from public,anon;
grant usage on schema trucking_private to authenticated;
create table public.driver_documents (
 id uuid primary key default gen_random_uuid(),
 driver_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('license-front','license-back','insurance','identity','background')),
 object_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 255),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 file_size bigint not null check(file_size between 1 and 10485760),
 status text not null default 'pending' check(status in ('pending','approved','replacement_requested')),
 version integer not null default 1,
 uploaded_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),
 review_note text not null default '',
 unique(driver_id,kind)
);
create table public.driver_document_events (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.driver_documents(id),
 driver_id uuid not null references public.profiles(id),
 actor_id uuid not null references public.profiles(id),
 action text not null check(action in ('uploaded','approved','replacement_requested')),
 version integer not null,
 object_path text not null,
 note text not null default '',
 created_at timestamptz not null default now()
);
create index driver_document_events_driver_time on public.driver_document_events(driver_id,created_at desc);
create index driver_document_events_document on public.driver_document_events(document_id);
create index driver_documents_reviewed_by on public.driver_documents(reviewed_by);
alter table public.driver_documents enable row level security;
alter table public.driver_document_events enable row level security;
revoke all on public.driver_documents,public.driver_document_events from anon,authenticated;
grant select on public.driver_documents,public.driver_document_events to authenticated;
create policy driver_document_read on public.driver_documents for select to authenticated using(
 public.is_trucking_admin() or (driver_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='driver' and status<>'removed')));
create policy driver_document_event_read on public.driver_document_events for select to authenticated using(
 public.is_trucking_admin() or (driver_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='driver' and status<>'removed')));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('driver-documents','driver-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy driver_document_file_insert on storage.objects for insert to authenticated with check(
 bucket_id='driver-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
 and (storage.foldername(name))[2] in ('license-front','license-back','insurance','identity','background')
 and exists(select 1 from public.profiles where id=(select auth.uid()) and role='driver' and status<>'removed'));
create policy driver_document_file_read on storage.objects for select to authenticated using(
 bucket_id='driver-documents' and (public.is_trucking_admin() or
 ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and role='driver' and status<>'removed'))));
-- Immutable objects: replacements use a fresh UUID path; no client update/delete policy.
create function trucking_private.submit_driver_document(p_kind text,p_path text,p_name text,p_expected_version integer)
returns public.driver_documents language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); doc public.driver_documents; obj storage.objects; old_version integer;
begin
 if who is null then raise exception 'Sign in to upload documents'; end if;
 perform 1 from public.profiles where id=who and role='driver' and status<>'removed' for update;
 if not found then raise exception 'Only active driver accounts can upload documents'; end if;
 if p_kind not in ('license-front','license-back','insurance','identity','background') or p_kind is null then raise exception 'Invalid document type'; end if;
 if p_path is null or p_path !~ ('^'||who::text||'/'||p_kind||'/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') then raise exception 'Invalid file path'; end if;
 if p_name is null or length(p_name) not between 1 and 255 then raise exception 'Invalid file name'; end if;
 select * into obj from storage.objects where bucket_id='driver-documents' and name=p_path;
 if not found then raise exception 'Upload the file before submitting it'; end if;
 if coalesce((obj.metadata->>'size')::bigint,0) not between 1 and 10485760 or coalesce(obj.metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'Invalid file type or size'; end if;
 select version into old_version from public.driver_documents where driver_id=who and kind=p_kind;
 if coalesce(old_version,0) is distinct from p_expected_version then raise exception 'This document changed. Refresh before replacing it'; end if;
 if exists(select 1 from public.driver_document_events where object_path=p_path) then raise exception 'Choose a new file upload'; end if;
 insert into public.driver_documents(driver_id,kind,object_path,file_name,mime_type,file_size)
 values(who,p_kind,p_path,p_name,obj.metadata->>'mimetype',(obj.metadata->>'size')::bigint)
 on conflict(driver_id,kind) do update set object_path=excluded.object_path,file_name=excluded.file_name,mime_type=excluded.mime_type,file_size=excluded.file_size,status='pending',version=public.driver_documents.version+1,uploaded_at=now(),reviewed_at=null,reviewed_by=null,review_note=''
 returning * into doc;
 insert into public.driver_document_events(document_id,driver_id,actor_id,action,version,object_path) values(doc.id,who,who,'uploaded',doc.version,doc.object_path);
 return doc;
end;$$;
create function trucking_private.review_driver_document(p_document_id uuid,p_version integer,p_status text,p_note text)
returns public.driver_documents language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); doc public.driver_documents;
begin
 if who is null or not public.is_trucking_admin() then raise exception 'Only administrators can review documents'; end if;
 if p_status is null or p_status not in ('approved','replacement_requested') then raise exception 'Invalid review decision'; end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'Review notes must be 1000 characters or fewer'; end if;
 if p_status='replacement_requested' and length(trim(coalesce(p_note,'')))<3 then raise exception 'Enter a reason for requesting a replacement'; end if;
 update public.driver_documents set status=p_status,reviewed_at=now(),reviewed_by=who,review_note=trim(coalesce(p_note,''))
 where id=p_document_id and version=p_version and status='pending' returning * into doc;
 if not found then raise exception 'This document changed or has already been reviewed. Refresh and try again'; end if;
 insert into public.driver_document_events(document_id,driver_id,actor_id,action,version,object_path,note) values(doc.id,doc.driver_id,who,p_status,doc.version,doc.object_path,doc.review_note);
 return doc;
end;$$;
revoke all on function trucking_private.submit_driver_document(text,text,text,integer),trucking_private.review_driver_document(uuid,integer,text,text) from public,anon;
grant execute on function trucking_private.submit_driver_document(text,text,text,integer),trucking_private.review_driver_document(uuid,integer,text,text) to authenticated;
create function public.submit_driver_document(p_kind text,p_path text,p_name text,p_expected_version integer)
returns public.driver_documents language sql security invoker set search_path='' as $$select trucking_private.submit_driver_document(p_kind,p_path,p_name,p_expected_version);$$;
create function public.review_driver_document(p_document_id uuid,p_version integer,p_status text,p_note text default '')
returns public.driver_documents language sql security invoker set search_path='' as $$select trucking_private.review_driver_document(p_document_id,p_version,p_status,p_note);$$;
revoke all on function public.submit_driver_document(text,text,text,integer),public.review_driver_document(uuid,integer,text,text) from public,anon;
grant execute on function public.submit_driver_document(text,text,text,integer),public.review_driver_document(uuid,integer,text,text) to authenticated;
commit;
-- Restrict the existing admin lookup and signup trigger helpers.
create or replace function trucking_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and status='active');$$;
revoke all on function trucking_private.is_admin() from public,anon;
grant execute on function trucking_private.is_admin() to authenticated;
create or replace function public.is_trucking_admin() returns boolean language sql stable security invoker set search_path='' as $$select trucking_private.is_admin();$$;
revoke all on function public.is_trucking_admin() from public,anon;
grant execute on function public.is_trucking_admin() to authenticated;
revoke all on function public.create_trucking_profile() from public,anon,authenticated;
