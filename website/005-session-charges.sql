  -- Run after 001 through 004. Completion consumes one trial or 100 points.
  begin;
  create table public.together_sessions (
    id uuid primary key,
    user_id uuid not null references public.together_accounts(user_id),
    room_reference text unique,
    used_trial boolean not null,
    created_at timestamptz not null default now()
  );
  alter table public.together_sessions enable row level security;
  revoke all on public.together_sessions from public, anon, authenticated;
  grant select on public.together_sessions to authenticated;
  create policy session_read_own on public.together_sessions for select to authenticated
    using (user_id = (select auth.uid()));

  create function public.together_complete_session(request_id uuid, room_code text default null)
  returns jsonb language plpgsql security definer set search_path = '' as $$
  declare
    uid uuid := auth.uid(); account public.together_accounts;
    previous public.together_sessions; room jsonb; ref text; balance bigint; trial boolean;
  begin
    if uid is null or not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
      raise exception 'Please sign in with a verified account' using errcode = '42501';
    end if;
    if request_id is null then raise exception 'A session ID is required'; end if;
    insert into public.together_accounts(user_id) values(uid) on conflict do nothing;
    select * into account from public.together_accounts where user_id = uid for update;
    -- An ambiguous network response can be retried even after a room expires.
    select * into previous from public.together_sessions where id = request_id;
    if found then
      if previous.user_id <> uid then raise exception 'Session unavailable' using errcode = '42501'; end if;
      return jsonb_build_object('used_trial', previous.used_trial, 'charged_points', case when previous.used_trial then 0 else 100 end);
    end if;
    if room_code is not null then
      select data into room from public.together_rooms where code = room_code and expires_at > now();
      if room is null or room->'host'->>'userId' is distinct from uid::text then
        raise exception 'Only the creator can complete this booth' using errcode = '42501';
      end if;
      ref := room->>'invite';
      select * into previous from public.together_sessions where room_reference = ref;
      if found then
        return jsonb_build_object('used_trial', previous.used_trial, 'charged_points', case when previous.used_trial then 0 else 100 end);
      end if;
    end if;
    trial := account.trial_used_at is null;
    select coalesce(sum(points),0) into balance from public.together_credit_ledger where user_id = uid;
    if not trial and balance < 100 then
      raise exception 'You need 100 points to complete this session. Please top up your account.' using errcode = 'P0001';
    end if;
    insert into public.together_sessions(id,user_id,room_reference,used_trial) values(request_id,uid,ref,trial);
    if trial then
      update public.together_accounts set trial_used_at = now() where user_id = uid;
    else
      insert into public.together_credit_ledger(user_id,points,kind,reference) values(uid,-100,'session',request_id);
    end if;
    return jsonb_build_object('used_trial',trial,'charged_points',case when trial then 0 else 100 end);
  end;
  $$;
  revoke all on function public.together_complete_session(uuid,text) from public, anon, authenticated;
  grant execute on function public.together_complete_session(uuid,text) to authenticated;
  commit;
