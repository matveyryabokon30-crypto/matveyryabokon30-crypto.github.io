-- Applied as pablicus_p04_home_avatar_read_proofs. Original policies remain authoritative.
create or replace function public.pablicus_home_cards(p_conversation_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
 me uuid := auth.uid(); cid uuid; card jsonb; cards jsonb := '[]'::jsonb;
 owners uuid[]; peer uuid; paths text[] := '{}'::text[]; own_path text; avatars jsonb;
begin
 if me is null or not exists(select 1 from public.profiles where id=me and is_approved) then
  raise exception 'HOME_NOT_ALLOWED' using errcode='42501';
 end if;
 if p_conversation_ids is null or cardinality(p_conversation_ids)>24 then
  raise exception 'HOME_CARD_LIMIT' using errcode='22023';
 end if;
 owners:=array[me];
 select avatar_url into own_path from public.profiles where id=me;
 if own_path is not null then paths:=array_append(paths,own_path); end if;
 for cid in select distinct unnest(p_conversation_ids) loop
  if cid is null then continue; end if;
  begin
   card:=public.pablicus_contact_card(cid);
   if card->>'kind'='contact' then
    peer:=(card->'profile'->>'id')::uuid;
    if not peer=any(owners) then owners:=array_append(owners,peer); end if;
    if card->'profile'->>'avatar_url' is not null then paths:=array_append(paths,card->'profile'->>'avatar_url'); end if;
    cards:=cards||jsonb_build_array(jsonb_build_object('kind','contact','conversation_id',cid,
     'profile',card->'profile','personal',jsonb_build_object(
      'first_name',coalesce(card->'personal'->>'first_name',''),
      'last_name',coalesce(card->'personal'->>'last_name',''))));
   else
    cards:=cards||jsonb_build_array(jsonb_build_object('kind',card->>'kind','conversation_id',cid));
   end if;
  exception when insufficient_privilege then
   cards:=cards||jsonb_build_array(jsonb_build_object('kind','unavailable','conversation_id',cid));
  end;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name,
  'object_id',o.id,'version',coalesce(o.version,o.updated_at::text),'mime',o.metadata->>'mimetype')),'[]'::jsonb)
 into avatars from storage.objects o
 where o.bucket_id='profile-media' and o.name=any(paths)
  and not coalesce(o.is_delete_marker,false) and o.archived_at is null;
 return jsonb_build_object('cards',cards,'owners',owners,'feed',public.pablicus_story_feed(owners),'avatars',avatars);
end;
$$;
revoke all on function public.pablicus_home_cards(uuid[]) from public,anon;
grant execute on function public.pablicus_home_cards(uuid[]) to authenticated,service_role;
