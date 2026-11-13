-- Run against the connected test workspace. All fixtures and decisions roll back.
begin;
select set_config('test.driver',(select id::text from public.profiles where role='driver' and status<>'removed' limit 1),true);
select set_config('test.admin',(select id::text from public.profiles where role='admin' and status='active' limit 1),true);
select set_config('test.path1',current_setting('test.driver')||'/insurance/'||gen_random_uuid()::text||'.png',true);
select set_config('test.path2',current_setting('test.driver')||'/insurance/'||gen_random_uuid()::text||'.png',true);
insert into storage.objects(bucket_id,name,metadata) values('driver-documents',current_setting('test.path1'),'{"size":100,"mimetype":"image/png"}'),('driver-documents',current_setting('test.path2'),'{"size":100,"mimetype":"image/png"}');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.driver'),'role','authenticated')::text,true);
do $$ declare doc public.driver_documents; begin
 select * into doc from public.submit_driver_document('insurance',current_setting('test.path1'),'QA rollback.png',0);
 perform set_config('test.doc',doc.id::text,true);
 if doc.status<>'pending' or doc.version<>1 then raise exception 'Submission did not start pending'; end if;
 if (select count(*) from public.driver_documents where id=doc.id)<>1 then raise exception 'Driver cannot read own file'; end if;
 begin perform public.review_driver_document(doc.id,1,'approved','');raise exception 'Driver approved own file';exception when others then if sqlerrm<>'Only administrators can review documents' then raise;end if;end;
 begin update public.driver_documents set status='approved' where id=doc.id;raise exception 'Driver directly changed approval';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- A signed-in customer must not see another user's documents or storage objects.
update public.profiles set role='customer' where id=current_setting('test.admin')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
do $$begin
 if exists(select 1 from public.driver_documents where id=current_setting('test.doc')::uuid) then raise exception 'Other user read driver document';end if;
 if exists(select 1 from storage.objects where name=current_setting('test.path1')) then raise exception 'Other user read private file';end if;
end $$;
reset role;
update public.profiles set role='driver' where id=current_setting('test.admin')::uuid;
set local role authenticated;
do $$begin
 if exists(select 1 from public.driver_documents where id=current_setting('test.doc')::uuid) then raise exception 'Other driver read private documents';end if;
 if exists(select 1 from storage.objects where name=current_setting('test.path1')) then raise exception 'Other driver read private storage';end if;
 begin
 insert into storage.objects(bucket_id,name,metadata) values('driver-documents',current_setting('test.driver')||'/identity/'||gen_random_uuid()::text||'.png','{"size":100,"mimetype":"image/png"}');
 raise exception 'Driver uploaded into another account';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.profiles set role='admin' where id=current_setting('test.admin')::uuid;
set local role authenticated;
do $$declare doc public.driver_documents;begin
 if not exists(select 1 from storage.objects where name=current_setting('test.path1')) then raise exception 'Admin cannot access private file';end if;
 select * into doc from public.review_driver_document(current_setting('test.doc')::uuid,1,'approved','QA rollback approval');
 if doc.status<>'approved' then raise exception 'Admin approval failed';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.driver'),'role','authenticated')::text,true);
do $$declare doc public.driver_documents;begin
 select * into doc from public.submit_driver_document('insurance',current_setting('test.path2'),'QA replacement.png',1);
 if doc.status<>'pending' or doc.version<>2 or doc.reviewed_by is not null or doc.review_note<>'' then raise exception 'Replacement retained approval';end if;
 begin perform public.submit_driver_document('insurance',current_setting('test.path1'),'stale.png',1);raise exception 'Stale replacement accepted';exception when others then if sqlerrm<>'This document changed. Refresh before replacing it' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
do $$begin
 begin perform public.review_driver_document(current_setting('test.doc')::uuid,1,'approved','');raise exception 'Stale review accepted';exception when others then if sqlerrm<>'This document changed or has already been reviewed. Refresh and try again' then raise;end if;end;
 begin perform public.review_driver_document(current_setting('test.doc')::uuid,2,'replacement_requested','');raise exception 'Replacement reason omitted';exception when others then if sqlerrm<>'Enter a reason for requesting a replacement' then raise;end if;end;
 perform public.review_driver_document(current_setting('test.doc')::uuid,2,'replacement_requested','Scan is blurry');
 if (select count(*) from public.driver_document_events where document_id=current_setting('test.doc')::uuid)<>4 then raise exception 'Review history missing';end if;
end $$;
reset role;
update public.profiles set status='removed' where id=current_setting('test.driver')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.driver'),'role','authenticated')::text,true);
do $$begin
 if exists(select 1 from public.driver_documents where id=current_setting('test.doc')::uuid) then raise exception 'Removed driver retained file access';end if;
 if exists(select 1 from storage.objects where name=current_setting('test.path1')) then raise exception 'Removed driver retained storage access';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.driver_documents;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.review_driver_document(uuid,integer,text,text)','execute') then raise exception 'Anonymous can review';end if;
end $$;
reset role;
rollback;
select 'PASS: owner isolation, customer isolation, admin review, replacement reset, version conflicts, required notes, audit history, removed access and anonymous denial. All fixtures rolled back.' as result;
