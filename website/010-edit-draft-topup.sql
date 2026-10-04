-- Run after 009. Submitted orders and orders with receipts cannot change amount.
begin;
create function public.together_change_topup(request_id uuid, requested_points integer)
returns public.together_topups language plpgsql security definer set search_path = '' as $$
declare item public.together_topups;
begin
 perform public.together_my_wallet();
 if requested_points is null or requested_points < 100 or requested_points > 10000 or requested_points % 100 <> 0 then
   raise exception 'Choose 100 to 10,000 points in steps of 100';
 end if;
 select * into item from public.together_topups where id=request_id and user_id=auth.uid() for update;
 if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
 if item.status <> 'draft' then raise exception 'Only unpaid drafts can change'; end if;
 if exists(select 1 from storage.objects where bucket_id='together-receipts' and name=item.user_id::text || '/' || item.id::text || '/receipt') then
   raise exception 'A receipt is already saved. Submit this order instead.';
 end if;
 update public.together_topups set points=requested_points,amount_mmk=(requested_points/100)*7000
 where id=request_id returning * into item;
 return item;
end; $$;
revoke all on function public.together_change_topup(uuid,integer) from public,anon,authenticated;
grant execute on function public.together_change_topup(uuid,integer) to authenticated;
commit;
