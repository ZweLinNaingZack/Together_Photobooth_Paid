-- Step 1. Run once in the Supabase SQL Editor as the project owner.
-- No payments or booth deductions are enabled by this migration.
begin;

create table public.together_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  trial_used_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.together_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.together_accounts(user_id) on delete restrict,
  points integer not null check (points <> 0),
  kind text not null check (kind in ('topup', 'session', 'refund')),
  reference uuid not null,
  created_at timestamptz not null default now(),
  unique (kind, reference),
  check ((kind = 'session' and points = -100) or (kind in ('topup', 'refund') and points > 0))
);
create index together_ledger_user_created on public.together_credit_ledger(user_id, created_at desc);
create table public.together_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.together_accounts enable row level security;
alter table public.together_credit_ledger enable row level security;
alter table public.together_admins enable row level security;
revoke all on public.together_accounts, public.together_credit_ledger, public.together_admins from public, anon, authenticated;
grant select on public.together_accounts, public.together_credit_ledger, public.together_admins to authenticated;
create policy account_read_own on public.together_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy ledger_read_own on public.together_credit_ledger for select to authenticated using (user_id = (select auth.uid()));
create policy admin_read_own on public.together_admins for select to authenticated using (user_id = (select auth.uid()));

-- Verified identity comes from auth.users, never editable user metadata.
-- Existing users are provisioned on their next account-page visit too.
create function public.together_my_wallet() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null or not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'A verified account is required' using errcode = '42501';
  end if;
  insert into public.together_accounts(user_id) values (uid) on conflict (user_id) do nothing;
  select jsonb_build_object(
    'points', (select coalesce(sum(l.points), 0) from public.together_credit_ledger l where l.user_id = uid),
    'trial_available', a.trial_used_at is null,
    'is_admin', exists(select 1 from public.together_admins x where x.user_id = uid),
    'history', coalesce((select jsonb_agg(rows) from (
      select l.id, l.points, l.kind, l.created_at from public.together_credit_ledger l
      where l.user_id = uid order by l.created_at desc, l.id limit 20
    ) rows), '[]'::jsonb)
  ) into result from public.together_accounts a where a.user_id = uid;
  return result;
end;
$$;
revoke all on function public.together_my_wallet() from public, anon, authenticated;
grant execute on function public.together_my_wallet() to authenticated;

-- Bind the administrator to the existing verified user ID, not a client email check.
do $$
declare admin_id uuid;
begin
  select id into strict admin_id from auth.users
  where lower(email) = 'zwelinnaing34@gmail.com' and email_confirmed_at is not null;
  insert into public.together_admins(user_id) values (admin_id);
end;
$$;
commit;
