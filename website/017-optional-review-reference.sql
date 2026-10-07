-- Bank references are optional; authorization, row locks, ledger and email triggers stay intact.
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
 if approve and ref <> '' and (length(ref) < 4 or length(ref) > 100) then raise exception 'Enter the bank transaction reference'; end if;
 perform 1 from public.together_accounts where user_id = item.user_id for update;
 update public.together_topups set status = case when approve then 'approved' else 'rejected' end,
   bank_reference = case when approve then nullif(ref,'') else null end, review_note = nullif(trim(note),''),
   reviewed_at = now(), reviewed_by = auth.uid() where id = request_id returning * into item;
 if approve then
   insert into public.together_credit_ledger(user_id,points,kind,reference) values(item.user_id,item.points,'topup',item.id);
 end if;
 return item;
end; $$;
