-- 021: Free mode (promotion until 31 Dec 2026). Run after 001-020 in the Supabase SQL Editor.
--
-- What it does
-- - Adds ONE switch: public.together_settings.free_mode. While it's on, booth sessions cost nothing:
--   no points are checked or taken, and nobody's one-time free session is used up.
-- - Nothing is deleted. Points balances, top-up orders, receipts, emails and the admin panel
--   all stay as they are, ready for when payments come back (see PAYMENTS-PLAYBOOK.md).
-- - A booth reserved while free stays free even if the switch is turned off mid-session.
--
-- Turn payments back ON later (one line, then follow PAYMENTS-PLAYBOOK.md):
--   update public.together_settings set free_mode = false, updated_at = now();
-- Change the "free until" date shown on the website:
--   update public.together_settings set free_until = '2027-01-31', updated_at = now();
begin;

-- The switch. A single row (id is always true), readable only through the function below.
create table if not exists public.together_settings(
  id boolean primary key default true check (id),
  free_mode boolean not null default false,
  free_until date,                       -- shown on the website only; it does NOT switch anything off by itself
  updated_at timestamptz not null default now()
);
alter table public.together_settings enable row level security;
revoke all on public.together_settings from public, anon, authenticated;
insert into public.together_settings(id, free_mode, free_until) values (true, true, '2026-12-31')
  on conflict (id) do update set free_mode = true, free_until = '2026-12-31', updated_at = now();

-- Used by the database itself.
create or replace function public.together_is_free() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select free_mode from public.together_settings where id), false);
$$;
revoke all on function public.together_is_free() from public, anon, authenticated;

-- Used by the website (also before sign-in, e.g. the home page banner).
create or replace function public.together_free_mode() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'free',  coalesce((select free_mode from public.together_settings where id), false),
    'until', (select free_until from public.together_settings where id));
$$;
revoke all on function public.together_free_mode() from public;
grant execute on function public.together_free_mode() to anon, authenticated;

-- Remember which reservations / sessions were free, so a later switch-off can't charge them.
alter table public.together_reservations add column if not exists free boolean not null default false;
alter table public.together_sessions add column if not exists free boolean not null default false;

-- Same as 007, plus the free-mode branches (marked FREE MODE).
create or replace function public.together_session_action(request_id uuid, operation text, room_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); email text; key text; r public.together_reservations;
  s public.together_sessions; room jsonb; ref text; trial boolean; balance bigint;
  free boolean:=public.together_is_free();   -- FREE MODE
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
    return jsonb_build_object('session_id',s.id,'used_trial',s.used_trial,'free',s.free,'completed',true);
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
      return jsonb_build_object('session_id',s.id,'used_trial',s.used_trial,'free',s.free,'completed',true);
    end if;
    select * into r from public.together_reservations where room_reference=ref;
    if not found then select * into r from public.together_reservations where id=request_id; end if;
  end if;
  if r.id is not null and (r.user_id<>uid or r.room_reference is distinct from ref or r.mailbox<>key) then raise exception 'Session unavailable' using errcode='42501'; end if;
  update public.together_reservations set status='expired' where status='reserved' and expires_at<=now() and (user_id=uid or mailbox=key);
  if operation='reserve' then
    if r.id is not null and r.status='reserved' and r.expires_at>now() then
      return jsonb_build_object('session_id',r.id,'used_trial',r.used_trial,'free',r.free,'completed',false);
    end if;
    if exists(select 1 from public.together_reservations where user_id=uid and status='reserved' and expires_at>now()) then
      raise exception 'You already have an active booth. Leave that booth first, or wait for its reservation to expire.';
    end if;
    if not public.together_room_limit('reservation:'||key,20) then raise exception 'Too many session attempts. Please wait a minute.'; end if;
    if free then
      trial := false;   -- FREE MODE: keep everyone's one-time free session for later
    else
      trial := not exists(select 1 from public.together_trial_mailboxes where mailbox=key)
        and not exists(select 1 from public.together_accounts where user_id=uid and trial_used_at is not null)
        and not exists(select 1 from public.together_reservations where mailbox=key and used_trial and status='reserved' and expires_at>now());
      select coalesce(sum(points),0) into balance from public.together_credit_ledger where user_id=uid;
      if not trial and balance<100 then raise exception 'You need 100 points to start this session. Please top up your account.'; end if;
    end if;
    insert into public.together_reservations(id,user_id,mailbox,used_trial,free,room_reference,status,expires_at)
      values(coalesce(r.id,request_id),uid,key,trial,free,ref,'reserved',now()+interval '45 minutes')
      on conflict(id) do update set status='reserved',used_trial=excluded.used_trial,free=excluded.free,expires_at=excluded.expires_at
      returning * into r;
    return jsonb_build_object('session_id',r.id,'used_trial',r.used_trial,'free',r.free,'completed',false);
  end if;
  if r.id is null or r.status<>'reserved' or r.expires_at<=now() then raise exception 'Your booth reservation expired. Please retry confirmation.'; end if;
  if r.free then
    null;   -- FREE MODE: nothing to charge
  elsif r.used_trial then
    insert into public.together_trial_mailboxes values(key,now());
    update public.together_accounts set trial_used_at=now() where user_id=uid;
  else
    select coalesce(sum(points),0) into balance from public.together_credit_ledger where user_id=uid;
    if balance<100 then raise exception 'You need 100 points to complete this session.'; end if;
    insert into public.together_credit_ledger(user_id,points,kind,reference) values(uid,-100,'session',r.id);
  end if;
  insert into public.together_sessions(id,user_id,room_reference,used_trial,free) values(r.id,uid,ref,r.used_trial,r.free);
  update public.together_reservations set status='completed' where id=r.id;
  return jsonb_build_object('session_id',r.id,'used_trial',r.used_trial,'free',r.free,'completed',true);
end; $$;
revoke all on function public.together_session_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.together_session_action(uuid,text,text) to authenticated;

-- Same as 016, plus whether the session was free.
create or replace function public.together_resume_session(request_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('session_id',id,'completed',true,'used_trial',used_trial,'free',free)
 from public.together_sessions where id=request_id and user_id=auth.uid();
$$;
revoke all on function public.together_resume_session(uuid) from public,anon;
grant execute on function public.together_resume_session(uuid) to authenticated;

-- Same as 007, but free reservations don't show as "reserved points".
create or replace function public.together_my_wallet() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; key text; held integer;
begin
  result:=public.together_wallet_base();
  select public.together_mailbox(email) into key from auth.users where id=auth.uid();
  select count(*)::integer*100 into held from public.together_reservations where user_id=auth.uid() and status='reserved' and not used_trial and not free and expires_at>now();
  return result || jsonb_build_object('reserved_points',held,'trial_available',
    (result->>'trial_available')::boolean and not exists(select 1 from public.together_trial_mailboxes where mailbox=key),
    'trial_reserved',exists(select 1 from public.together_reservations where mailbox=key and status='reserved' and used_trial and expires_at>now()));
end; $$;
revoke all on function public.together_my_wallet() from public,anon,authenticated;
grant execute on function public.together_my_wallet() to authenticated;

commit;

-- Check: should show free_mode = true, free_until = 2026-12-31.
select free_mode, free_until from public.together_settings;
