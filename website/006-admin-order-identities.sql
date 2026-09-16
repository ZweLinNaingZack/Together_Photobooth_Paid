-- Run after 005. Only verified administrators can read customer identities.
begin;
create function public.together_admin_orders() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.together_admins a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(row_to_json(r)) from (
    select t.id,t.user_id,t.points,t.status,t.created_at,t.review_note,
      u.email as customer_email,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),'Customer') as customer_name
    from public.together_topups t join auth.users u on u.id=t.user_id
    where t.status <> 'draft'
    order by (t.status='pending') desc,t.created_at desc limit 100
  ) r),'[]'::jsonb);
end; $$;
revoke all on function public.together_admin_orders() from public,anon,authenticated;
grant execute on function public.together_admin_orders() to authenticated;
commit;
