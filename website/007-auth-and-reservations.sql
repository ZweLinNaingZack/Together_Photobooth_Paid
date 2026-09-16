-- Run after 006. Then enable together_before_user_created in Auth Hooks.
begin;
create function public.together_mailbox(value text) returns text language sql immutable set search_path='' as $$
  select case when split_part(lower(trim(value)),'@',2)='gmail.com'
    then replace(split_part(split_part(lower(trim(value)),'@',1),'+',1),'.','') || '@gmail.com'
    else lower(trim(value)) end;
$$;
revoke all on function public.together_mailbox(text) from public,anon,authenticated;

create function public.together_before_user_created(event jsonb) returns jsonb
language plpgsql set search_path='' as $$
begin
  if coalesce(event->'user'->>'email','') !~* '^[^[:space:]@]+@gmail\.com$'
    or coalesce(event->'user'->'app_metadata'->>'provider','') not in ('email','google') then
    return '{"error":{"http_code":403,"message":"Please use a gmail.com address with Google or email sign-up."}}'::jsonb;
  end if;
  return '{}'::jsonb;
end; $$;
revoke all on function public.together_before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.together_before_user_created(jsonb) to supabase_auth_admin;

create table public.together_trial_mailboxes(mailbox text primary key, consumed_at timestamptz not null);
insert into public.together_trial_mailboxes
select public.together_mailbox(u.email),min(a.trial_used_at)
from public.together_accounts a join auth.users u on u.id=a.user_id
where a.trial_used_at is not null and u.email is not null group by public.together_mailbox(u.email);
create table public.together_reservations(
 id uuid primary key, user_id uuid not null references public.together_accounts(user_id),
 mailbox text not null, used_trial boolean not null, room_reference text unique,
 status text not null check(status in ('reserved','completed','released','expired')),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index together_reservation_user on public.together_reservations(user_id,status);
create index together_reservation_mailbox on public.together_reservations(mailbox,status);
alter table public.together_trial_mailboxes enable row level security;
alter table public.together_reservations enable row level security;
revoke all on public.together_trial_mailboxes,public.together_reservations from public,anon,authenticated;

create function public.together_session_action(request_id uuid, operation text, room_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); email text; key text; r public.together_reservations;
  s public.together_sessions; room jsonb; ref text; trial boolean; balance bigint;
begin
  select u.email into email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
  if email is null then raise exception 'Please sign in with a verified account' using errcode='42501'; end if;
  if request_id is null or operation not in ('reserve','complete','release') or operation is null then raise exception 'Invalid session request'; end if;
  key:=public.together_mailbox(email);
  perform pg_advisory_xact_lock(hashtextextended(key,732));
  insert into public.together_accounts(user_id) values(uid) on conflict do nothing;
  perform 1 from public.together_accounts where user_id=uid for update;
  select * into s from public.together_sessions where id=request_id;
  if found then
    if s.user_id<>uid then raise exception 'Session unavailable' using errcode='42501'; end if;
    return jsonb_build_object('session_id',s.id,'used_trial',s.used_trial,'completed',true);
  end if;
  select * into r from public.together_reservations where id=request_id;
  if found and r.user_id<>uid then raise exception 'Session unavailable' using errcode='42501'; end if;
  if operation='release' then
    update public.together_reservations set status='released' where id=request_id and user_id=uid and status='reserved';
    return '{"released":true}'::jsonb;
  end if;
  if room_code is not null then
    select data into room from public.together_rooms where code=room_code and expires_at>now();
    if room is null or room->'host'->>'userId' is distinct from uid::text then
      raise exception 'Only the creator can authorize this booth' using errcode='42501';
    end if;
    ref:=room->>'invite';
    select * into s from public.together_sessions where room_reference=ref;
    if found then
      if s.user_id<>uid then raise exception 'Session unavailable' using errcode='42501'; end if;
      return jsonb_build_object('session_id',s.id,'used_trial',s.used_trial,'completed',true);
    end if;
    select * into r from public.together_reservations where room_reference=ref;
    if not found then select * into r from public.together_reservations where id=request_id; end if;
  end if;
  if r.id is not null and (r.user_id<>uid or r.room_reference is distinct from ref or r.mailbox<>key) then raise exception 'Session unavailable' using errcode='42501'; end if;
  update public.together_reservations set status='expired' where status='reserved' and expires_at<=now() and (user_id=uid or mailbox=key);
  if operation='reserve' then
    if r.id is not null and r.status='reserved' and r.expires_at>now() then
      return jsonb_build_object('session_id',r.id,'used_trial',r.used_trial,'completed',false);
    end if;
    if exists(select 1 from public.together_reservations where user_id=uid and status='reserved' and expires_at>now()) then
      raise exception 'You already have an active booth. Leave that booth first, or wait for its reservation to expire.';
    end if;
    if not public.together_room_limit('reservation:'||key,20) then raise exception 'Too many session attempts. Please wait a minute.'; end if;
    trial := not exists(select 1 from public.together_trial_mailboxes where mailbox=key)
      and not exists(select 1 from public.together_accounts where user_id=uid and trial_used_at is not null)
      and not exists(select 1 from public.together_reservations where mailbox=key and used_trial and status='reserved' and expires_at>now());
    select coalesce(sum(points),0) into balance from public.together_credit_ledger where user_id=uid;
    if not trial and balance<100 then raise exception 'You need 100 points to start this session. Please top up your account.'; end if;
    insert into public.together_reservations(id,user_id,mailbox,used_trial,room_reference,status,expires_at)
      values(coalesce(r.id,request_id),uid,key,trial,ref,'reserved',now()+interval '45 minutes')
      on conflict(id) do update set status='reserved',used_trial=excluded.used_trial,expires_at=excluded.expires_at
      returning * into r;
    return jsonb_build_object('session_id',r.id,'used_trial',r.used_trial,'completed',false);
  end if;
  if r.id is null or r.status<>'reserved' or r.expires_at<=now() then raise exception 'Your booth reservation expired. Please retry confirmation.'; end if;
  if r.used_trial then
    insert into public.together_trial_mailboxes values(key,now());
    update public.together_accounts set trial_used_at=now() where user_id=uid;
  else
    select coalesce(sum(points),0) into balance from public.together_credit_ledger where user_id=uid;
    if balance<100 then raise exception 'You need 100 points to complete this session.'; end if;
    insert into public.together_credit_ledger(user_id,points,kind,reference) values(uid,-100,'session',r.id);
  end if;
  insert into public.together_sessions(id,user_id,room_reference,used_trial) values(r.id,uid,ref,r.used_trial);
  update public.together_reservations set status='completed' where id=r.id;
  return jsonb_build_object('session_id',r.id,'used_trial',r.used_trial,'completed',true);
end; $$;
revoke all on function public.together_session_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.together_session_action(uuid,text,text) to authenticated;

-- Replace the previous completion entry point so direct calls also need a reservation.
create or replace function public.together_complete_session(request_id uuid, room_code text default null)
returns jsonb language sql security definer set search_path='' as $$
  select public.together_session_action(request_id,'complete',room_code);
$$;

create function public.together_room_has_ticket(invitation text, creator uuid) returns boolean
language sql security definer set search_path='' as $$
  select exists(select 1 from public.together_reservations where room_reference=invitation and user_id=creator and status='reserved' and expires_at>now())
    or exists(select 1 from public.together_sessions where room_reference=invitation and user_id=creator);
$$;
revoke all on function public.together_room_has_ticket(text,uuid) from public,anon,authenticated;
grant execute on function public.together_room_has_ticket(text,uuid) to service_role;

alter function public.together_my_wallet() rename to together_wallet_base;
revoke all on function public.together_wallet_base() from public,anon,authenticated;
create function public.together_my_wallet() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; key text; held integer;
begin
  result:=public.together_wallet_base();
  select public.together_mailbox(email) into key from auth.users where id=auth.uid();
  select count(*)::integer*100 into held from public.together_reservations where user_id=auth.uid() and status='reserved' and not used_trial and expires_at>now();
  return result || jsonb_build_object('reserved_points',held,'trial_available',
    (result->>'trial_available')::boolean and not exists(select 1 from public.together_trial_mailboxes where mailbox=key),
    'trial_reserved',exists(select 1 from public.together_reservations where mailbox=key and status='reserved' and used_trial and expires_at>now()));
end; $$;
revoke all on function public.together_my_wallet() from public,anon,authenticated;
grant execute on function public.together_my_wallet() to authenticated;
commit;
