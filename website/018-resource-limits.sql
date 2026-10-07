-- Run after 017. Keeps existing RPC signatures, auth, room signaling and billing.
begin;
alter table public.together_login_limits add column if not exists requests integer not null default 0;
alter table public.together_login_limits add column if not exists request_until timestamptz;
create index if not exists together_login_retention on public.together_login_limits(updated_at);

-- A separate transaction avoids retention locks conflicting with IP/email locks.
create or replace function public.together_prune_login_limits()
returns void language sql security definer set search_path = '' as $$
 delete from public.together_login_limits where key in (
  select key from public.together_login_limits
  where updated_at<now()-interval '7 days'
   and coalesce(locked_until,now())<=now() and coalesce(lease_until,now())<=now()
  order by updated_at limit 100 for update skip locked
 );
$$;
revoke all on function public.together_prune_login_limits() from public,anon,authenticated;
grant execute on function public.together_prune_login_limits() to service_role;

create or replace function public.together_login_limit(keys text[], operation text)
returns integer language plpgsql security definer set search_path = '' as $$
declare k text; ip_key text; email_key text; r public.together_login_limits; wait_seconds integer:=0;
begin
 if cardinality(keys)<>2 or operation not in ('begin','failure','success','release') then raise exception 'Invalid operation'; end if;
 select value into ip_key from unnest(keys) value where value like 'ip:%';
 select value into email_key from unnest(keys) value where value like 'email:%';
 if ip_key is null or email_key is null then raise exception 'Invalid keys'; end if;
 if operation='begin' then
  insert into public.together_login_limits(key) values(ip_key) on conflict do nothing;
 end if;
 -- Every operation uses IP then email. A blocked IP never allocates an email row.
 select * into r from public.together_login_limits where key=ip_key for update;
 if operation='begin' then
  wait_seconds:=greatest(0,coalesce(ceil(extract(epoch from r.locked_until-now()))::int,0),coalesce(ceil(extract(epoch from r.lease_until-now()))::int,0));
  if wait_seconds>0 then return wait_seconds; end if;
  if r.request_until>now() and r.requests>=30 then
   return greatest(1,ceil(extract(epoch from r.request_until-now()))::int);
  end if;
  update public.together_login_limits set
   requests=case when request_until>now() then requests+1 else 1 end,
   request_until=case when request_until>now() then request_until else now()+interval '1 minute' end,
   updated_at=now() where key=ip_key;
  insert into public.together_login_limits(key) values(email_key) on conflict do nothing;
 end if;
 select * into r from public.together_login_limits where key=email_key for update;
 if operation='begin' then
  wait_seconds:=greatest(0,coalesce(ceil(extract(epoch from r.locked_until-now()))::int,0),coalesce(ceil(extract(epoch from r.lease_until-now()))::int,0));
  if wait_seconds>0 then return wait_seconds; end if;
 end if;
 foreach k in array array[ip_key,email_key] loop
  if operation='begin' then
   update public.together_login_limits set failures=case when locked_until<=now() then 0 else failures end,
    locked_until=case when locked_until<=now() then null else locked_until end,
    lease_until=now()+interval '30 seconds',updated_at=now() where key=k;
  elsif operation='success' then
   update public.together_login_limits set failures=0,locked_until=null,lease_until=null,updated_at=now() where key=k;
  elsif operation='failure' then
   update public.together_login_limits set failures=failures+1,
    locked_until=case when failures+1>=5 then now()+interval '5 minutes' else null end,
    lease_until=null,updated_at=now() where key=k returning * into r;
   if r.failures>=5 then wait_seconds:=300; end if;
  else
   update public.together_login_limits set lease_until=null,updated_at=now() where key=k;
  end if;
 end loop;
 -- Invalid/expired CAPTCHA and successful logins must not leave empty email buckets.
 if operation in ('release','success') then
  delete from public.together_login_limits where key=email_key and failures=0
    and coalesce(locked_until,now())<=now() and lease_until is null;
 end if;
 return wait_seconds;
end $$;
revoke all on function public.together_login_limit(text[],text) from public,anon,authenticated;
grant execute on function public.together_login_limit(text[],text) to service_role;

create index if not exists together_room_owner on public.together_rooms ((data->'host'->>'userId'));
create or replace function public.together_save_room(room_code text, expected_version integer, room_data jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer; owner_id text;
begin
 if expected_version=0 then
  owner_id:=nullif(room_data->'host'->>'userId','');
  if owner_id is null then raise exception 'Room owner required'; end if;
  perform pg_advisory_xact_lock(704002);
  delete from public.together_rooms where expires_at<now();
  -- Matches the room service's existing 60-second absent-host expiry rule.
  delete from public.together_rooms where data->'host'->>'userId'=owner_id
   and case when jsonb_typeof(data->'host'->'seen')='number'
    then (data->'host'->>'seen')::numeric < extract(epoch from now())*1000-60000 else false end;
  if (select count(*) from public.together_rooms where data->'host'->>'userId'=owner_id)>=3 then
   raise exception 'Owner room limit reached';
  end if;
  if (select count(*) from public.together_rooms)>=500 then raise exception 'Rooms at capacity'; end if;
  insert into public.together_rooms(code,invite,data,expires_at)
  values(room_code,room_data->>'invite',room_data,to_timestamp((room_data->>'expires')::double precision/1000)) on conflict do nothing;
 elsif room_data is null then
  delete from public.together_rooms where code=room_code and version=expected_version;
 else
  update public.together_rooms set data=room_data,version=version+1 where code=room_code and version=expected_version;
 end if;
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function public.together_save_room(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.together_save_room(text,integer,jsonb) to service_role;
commit;
