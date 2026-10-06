-- Apply before deploying the login gateway. Then enable the Password Verification
-- Auth hook: public.together_password_verification. Never grant client access.
create table if not exists public.together_login_limits (
 key text primary key, failures integer not null default 0,
 locked_until timestamptz, lease_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.together_login_limits enable row level security;
revoke all on public.together_login_limits from public,anon,authenticated;

create or replace function public.together_login_limit(keys text[], operation text)
returns integer language plpgsql security definer set search_path=public as $$
declare k text; r public.together_login_limits; wait_seconds integer:=0;
begin
 if cardinality(keys)<1 or cardinality(keys)>2 or operation not in ('begin','failure','success','release') then raise exception 'Invalid operation'; end if;
 -- Consistent lock order serializes concurrent requests across server instances.
 for k in select distinct unnest(keys) order by 1 loop
  insert into together_login_limits(key) values(k) on conflict do nothing;
  select * into r from together_login_limits where key=k for update;
  if operation='begin' then
   wait_seconds:=greatest(wait_seconds,coalesce(ceil(extract(epoch from r.locked_until-now()))::int,0),coalesce(ceil(extract(epoch from r.lease_until-now()))::int,0));
  end if;
 end loop;
 if operation='begin' and wait_seconds>0 then return wait_seconds; end if;
 foreach k in array keys loop
  select * into r from together_login_limits where key=k;
  if operation='begin' then
   update together_login_limits set failures=case when locked_until<=now() then 0 else failures end,locked_until=case when locked_until<=now() then null else locked_until end,lease_until=now()+interval '30 seconds',updated_at=now() where key=k;
  elsif operation='success' then
   update together_login_limits set failures=0,locked_until=null,lease_until=null,updated_at=now() where key=k;
  elsif operation='failure' then
   update together_login_limits set failures=failures+1,locked_until=case when failures+1>=5 then now()+interval '5 minutes' else null end,lease_until=null,updated_at=now() where key=k returning * into r;
   if r.failures>=5 then wait_seconds:=300; end if;
  else update together_login_limits set lease_until=null,updated_at=now() where key=k;
  end if;
 end loop;
 return wait_seconds;
end $$;
revoke all on function public.together_login_limit(text[],text) from public,anon,authenticated;
grant execute on function public.together_login_limit(text[],text) to service_role;

create or replace function public.together_password_verification(event jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare k text:='auth:'||(event->>'user_id'); r public.together_login_limits;
begin
 insert into together_login_limits(key) values(k) on conflict do nothing;
 select * into r from together_login_limits where key=k for update;
 if r.locked_until>now() then
  return jsonb_build_object('decision','reject','message','together_login_locked:'||ceil(extract(epoch from r.locked_until))::bigint,'should_logout_user',false);
 end if;
 if (event->>'valid')::boolean then
  update together_login_limits set failures=0,locked_until=null,updated_at=now() where key=k;
 else
  update together_login_limits set failures=case when locked_until<=now() then 1 else failures+1 end,
   locked_until=case when locked_until<=now() then null when failures+1>=5 then now()+interval '5 minutes' else null end,updated_at=now() where key=k;
 end if;
 return '{"decision":"continue"}'::jsonb;
end $$;
revoke all on function public.together_password_verification(jsonb) from public,anon,authenticated;
grant execute on function public.together_password_verification(jsonb) to supabase_auth_admin;
