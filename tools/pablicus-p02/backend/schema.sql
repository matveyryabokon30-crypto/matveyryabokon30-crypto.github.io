-- Already applied additive migration: pablicus_p02_authorized_media_descriptor.
-- SECURITY INVOKER intentionally preserves storage.objects RLS of caller.
create or replace function public.pablicus_media_describe(p_items jsonb)
returns table(bucket text,path text,object_id uuid,version text,bytes bigint,mime text)
language plpgsql stable security invoker set search_path = ''
as $$
begin
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 24 then
  raise exception 'invalid_items' using errcode='22023';
 end if;
 if auth.uid() is null and coalesce(auth.role(),'') <> 'service_role' then return; end if;
 return query
 select distinct o.bucket_id,o.name,o.id,coalesce(o.version,o.updated_at::text),coalesce((o.metadata->>'size')::bigint,0),coalesce(o.metadata->>'mimetype','')
 from jsonb_to_recordset(p_items) as r(bucket text,path text)
 join storage.objects o on o.bucket_id=r.bucket and o.name=r.path
 where o.bucket_id in ('message-media','profile-media','pablicus-story-media') and length(r.path) between 1 and 1024 and not coalesce(o.is_delete_marker,false) and o.archived_at is null;
end;
$$;
revoke all on function public.pablicus_media_describe(jsonb) from public,anon;
grant execute on function public.pablicus_media_describe(jsonb) to authenticated,service_role;
