-- Run after 008 in the Supabase SQL Editor before deploying the new checkout.
begin;
alter table public.together_topups drop constraint together_topups_points_check;
alter table public.together_topups drop constraint together_topups_amount_mmk_check;
alter table public.together_topups add constraint together_topups_points_check check (points between 100 and 10000 and points % 100 = 0);
-- Preserve historical approved 1,000-point / 7,000-MMK orders from the old pricing.
alter table public.together_topups add constraint together_topups_amount_mmk_check check (
 amount_mmk = (points / 100) * 7000 or (status = 'approved' and points = 1000 and amount_mmk = 7000)
);
drop function public.together_start_topup();
create function public.together_start_topup(requested_points integer default 100) returns public.together_topups
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); item public.together_topups;
begin
 perform public.together_my_wallet();
 if requested_points is null or requested_points < 100 or requested_points > 10000 or requested_points % 100 <> 0 then
  raise exception 'Choose 100 to 10,000 points in steps of 100';
 end if;
 perform 1 from public.together_accounts where user_id = uid for update;
 select * into item from public.together_topups where user_id = uid and status in ('draft','pending');
 if found then return item; end if;
 if (select count(*) from public.together_topups where user_id = uid and created_at > now() - interval '24 hours') >= 5 then
  raise exception 'Daily request limit reached' using errcode = 'P0001';
 end if;
 insert into public.together_topups(user_id,points,amount_mmk)
 values (uid,requested_points,(requested_points / 100) * 7000) returning * into item;
 return item;
end; $$;
revoke all on function public.together_start_topup(integer) from public,anon,authenticated;
grant execute on function public.together_start_topup(integer) to authenticated;
create or replace function public.together_review_topup(request_id uuid, approve boolean, transfer_reference text, note text)
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
   insert into public.together_credit_ledger(user_id,points,kind,reference) values(item.user_id,item.points,'topup',item.id);
 end if;
 return item;
end; $$;


create or replace function public.together_admin_orders() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.together_admins a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(row_to_json(r)) from (
    select t.id,t.user_id,t.points,t.amount_mmk,t.status,t.created_at,t.review_note,
      u.email as customer_email,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),'Customer') as customer_name
    from public.together_topups t join auth.users u on u.id=t.user_id
    where t.status <> 'draft'
    order by (t.status='pending') desc,t.created_at desc limit 100
  ) r),'[]'::jsonb);
end; $$;

commit;
