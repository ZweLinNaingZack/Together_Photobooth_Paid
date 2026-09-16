-- Run once, after 001-wallet-foundation.sql. No booth charging yet.
begin;
create table public.together_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.together_accounts(user_id),
  amount_mmk integer not null default 7000 check (amount_mmk = 7000),
  points integer not null default 100 check (points = 100),
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  bank_reference text unique,
  review_note text check (length(review_note) <= 500)
);
create unique index together_one_open_topup on public.together_topups(user_id) where status in ('draft','pending');
create index together_topup_history on public.together_topups(user_id, created_at desc);
alter table public.together_topups enable row level security;
revoke all on public.together_topups from public, anon, authenticated;
grant select on public.together_topups to authenticated;
create policy topups_read on public.together_topups for select to authenticated using (
 user_id = (select auth.uid()) or exists(select 1 from public.together_admins where user_id = (select auth.uid()))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('together-receipts','together-receipts',false,5242880,array['image/jpeg','image/png','image/webp']);
-- One immutable object per request; no client UPDATE/DELETE policies.
create policy together_receipt_insert on storage.objects for insert to authenticated with check (
 bucket_id = 'together-receipts' and exists (
  select 1 from public.together_topups t where t.user_id = (select auth.uid()) and t.status = 'draft'
  and name = t.user_id::text || '/' || t.id::text || '/receipt'
 )
);
create policy together_receipt_read on storage.objects for select to authenticated using (
 bucket_id = 'together-receipts' and exists (
  select 1 from public.together_topups t where name = t.user_id::text || '/' || t.id::text || '/receipt'
  and (t.user_id = (select auth.uid()) or exists(select 1 from public.together_admins where user_id = (select auth.uid())))
 )
);

create function public.together_start_topup() returns public.together_topups
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); item public.together_topups;
begin
 perform public.together_my_wallet(); -- verified user; provisions wallet if needed
 perform 1 from public.together_accounts where user_id = uid for update;
 select * into item from public.together_topups where user_id = uid and status in ('draft','pending');
 if found then return item; end if;
 if (select count(*) from public.together_topups where user_id = uid and created_at > now() - interval '24 hours') >= 5 then
   raise exception 'Daily request limit reached' using errcode = 'P0001';
 end if;
 insert into public.together_topups(user_id) values (uid) returning * into item;
 return item;
end; $$;

create function public.together_submit_topup(request_id uuid) returns public.together_topups
language plpgsql security definer set search_path = '' as $$
declare item public.together_topups;
begin
 perform public.together_my_wallet();
 select * into item from public.together_topups where id = request_id and user_id = auth.uid() for update;
 if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
 if item.status <> 'draft' then return item; end if;
 if not exists(select 1 from storage.objects where bucket_id = 'together-receipts'
   and name = item.user_id::text || '/' || item.id::text || '/receipt') then
   raise exception 'Upload a receipt first';
 end if;
 update public.together_topups set status = 'pending', submitted_at = now() where id = request_id returning * into item;
 return item;
end; $$;

-- Bank reference must be transcribed from the actual incoming KBZPay transaction.
-- Lock + unique ledger reference makes retries/concurrent approvals credit once.
create function public.together_review_topup(request_id uuid, approve boolean, transfer_reference text, note text)
returns public.together_topups language plpgsql security definer set search_path = '' as $$
declare item public.together_topups; ref text := upper(regexp_replace(coalesce(transfer_reference,''), '[^a-zA-Z0-9]', '', 'g'));
begin
 if not exists(select 1 from public.together_admins a join auth.users u on u.id = a.user_id
   where a.user_id = auth.uid() and u.email_confirmed_at is not null) then
   raise exception 'Administrator required' using errcode = '42501';
 end if;
 select * into item from public.together_topups where id = request_id for update;
 if not found then raise exception 'Request unavailable'; end if;
 if (approve and item.status = 'approved') or (not approve and item.status = 'rejected') then return item; end if;
 if item.status <> 'pending' then raise exception 'Only pending requests can be reviewed'; end if;
 if approve is null or length(coalesce(note,'')) > 500 then raise exception 'Invalid review'; end if;
 if approve and (length(ref) < 4 or length(ref) > 100) then raise exception 'Enter the bank transaction reference'; end if;
 if not approve and length(trim(coalesce(note,''))) = 0 then raise exception 'Enter a rejection reason'; end if;
 perform 1 from public.together_accounts where user_id = item.user_id for update;
 update public.together_topups set status = case when approve then 'approved' else 'rejected' end,
   bank_reference = case when approve then ref else null end, review_note = nullif(trim(note),''),
   reviewed_at = now(), reviewed_by = auth.uid() where id = request_id returning * into item;
 if approve then
   insert into public.together_credit_ledger(user_id,points,kind,reference) values(item.user_id,100,'topup',item.id);
 end if;
 return item;
end; $$;

revoke all on function public.together_start_topup(), public.together_submit_topup(uuid), public.together_review_topup(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.together_start_topup(), public.together_submit_topup(uuid), public.together_review_topup(uuid,boolean,text,text) to authenticated;
commit;
