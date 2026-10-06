-- Run after 010. Email jobs commit atomically with payment status and credits.
begin;
alter table public.together_topups add column payment_reference text check(length(payment_reference)<=100);
create table public.together_email_jobs (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.together_topups(id),
 event text not null check(event in ('pending','approved','rejected')),
 payload jsonb not null, email_body jsonb,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 first_attempt_at timestamptz,
 lease uuid, lease_until timestamptz,
 provider_id text, last_error text, created_at timestamptz not null default now(),
 unique(order_id,event)
);
alter table public.together_email_jobs enable row level security;
revoke all on public.together_email_jobs from public,anon,authenticated;

create function public.together_queue_payment_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare customer auth.users; balance bigint;
begin
 if new.status=old.status or new.status not in ('pending','approved','rejected') then return new; end if;
 select * into customer from auth.users where id=new.user_id;
 select coalesce(sum(points),0) into balance from public.together_credit_ledger where user_id=new.user_id;
 insert into public.together_email_jobs(order_id,event,payload) values(new.id,new.status,jsonb_build_object(
  'orderId',new.id,'userId',new.user_id,'email',customer.email,
  'name',coalesce(nullif(customer.raw_user_meta_data->>'full_name',''),nullif(customer.raw_user_meta_data->>'name',''),'Customer'),
  'amount',new.amount_mmk,'points',new.points,'balance',balance,'reference',new.payment_reference,
  'reason',new.review_note,'date',coalesce(new.reviewed_at,new.submitted_at,new.created_at)
 )) on conflict(order_id,event) do nothing;
 return new;
end; $$;
-- Deferred until the ledger insert has happened, so approval emails have the new balance.
create constraint trigger together_payment_email after update on public.together_topups
deferrable initially deferred for each row execute function public.together_queue_payment_email();
revoke all on function public.together_queue_payment_email() from public,anon,authenticated;

drop function public.together_submit_topup(uuid);
create function public.together_submit_topup(request_id uuid, payment_reference text default null)
returns public.together_topups language plpgsql security definer set search_path='' as $$
declare item public.together_topups; ref text:=nullif(trim(payment_reference),'');
begin
 perform public.together_my_wallet();
 if length(ref)>100 then raise exception 'Payment reference is too long'; end if;
 select * into item from public.together_topups where id=request_id and user_id=auth.uid() for update;
 if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
 if item.status<>'draft' then return item; end if;
 if ref is null and not exists(select 1 from storage.objects where bucket_id='together-receipts' and name=item.user_id::text||'/'||item.id::text||'/receipt') then
  raise exception 'Upload a receipt or enter a payment reference first';
 end if;
 update public.together_topups set status='pending',submitted_at=now(),payment_reference=ref where id=request_id returning * into item;
 return item;
end; $$;
revoke all on function public.together_submit_topup(uuid,text) from public,anon,authenticated;
grant execute on function public.together_submit_topup(uuid,text) to authenticated;

create function public.together_claim_email() returns setof public.together_email_jobs
language plpgsql security definer set search_path='' as $$
begin
 -- Never automatically retry an ambiguous send outside Resend's 24-hour dedup window.
 update public.together_email_jobs set status='failed',last_error='Retry window expired; reconcile provider logs before manual recovery'
 where status in ('queued','sending') and first_attempt_at < now()-interval '23 hours';
 return query with candidate as (
  select id from public.together_email_jobs where
  (status='queued' and available_at<=now() or status='sending' and lease_until<now()) and attempts<8
  order by created_at for update skip locked limit 1
 ) update public.together_email_jobs j set status='sending',attempts=attempts+1,
 first_attempt_at=coalesce(first_attempt_at,now()),lease=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 from candidate c where j.id=c.id returning j.*;
end; $$;
create function public.together_prepare_email(job_id uuid, lease_id uuid, body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update public.together_email_jobs set email_body=coalesce(email_body,body)
 where id=job_id and lease=lease_id and status='sending' returning email_body into result;
 return result;
end; $$;
revoke all on function public.together_prepare_email(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.together_prepare_email(uuid,uuid,jsonb) to service_role;
create function public.together_finish_email(job_id uuid, lease_id uuid, sent_id text, failure text, permanent boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.together_email_jobs set status=case when sent_id is not null then 'sent' when permanent or attempts>=8 then 'failed' else 'queued' end,
 provider_id=sent_id,last_error=left(failure,200),available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),lease_until=null
 where id=job_id and lease=lease_id and status='sending';
end; $$;
revoke all on function public.together_claim_email(),public.together_finish_email(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.together_claim_email(),public.together_finish_email(uuid,uuid,text,text,boolean) to service_role;
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
 perform 1 from public.together_accounts where user_id = item.user_id for update;
 update public.together_topups set status = case when approve then 'approved' else 'rejected' end,
   bank_reference = case when approve then ref else null end, review_note = nullif(trim(note),''),
   reviewed_at = now(), reviewed_by = auth.uid() where id = request_id returning * into item;
 if approve then
   insert into public.together_credit_ledger(user_id,points,kind,reference) values(item.user_id,item.points,'topup',item.id);
 end if;
 return item;
end; $$;


drop function public.together_admin_orders();
create function public.together_admin_orders(requested_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.together_admins a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(row_to_json(r)) from (
    select t.id,t.user_id,t.points,t.amount_mmk,t.payment_reference,t.status,t.created_at,t.review_note,
      u.email as customer_email,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),'Customer') as customer_name
    from public.together_topups t join auth.users u on u.id=t.user_id
    where t.status <> 'draft' and (requested_id is null or t.id=requested_id)
    order by (t.status='pending') desc,t.created_at desc limit 100
  ) r),'[]'::jsonb);
end; $$;
revoke all on function public.together_admin_orders(uuid) from public,anon,authenticated;
grant execute on function public.together_admin_orders(uuid) to authenticated;
commit;
