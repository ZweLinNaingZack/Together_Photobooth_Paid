-- Run after 013. Only the server may read failure counts.
create or replace function public.together_login_attempts_remaining(keys text[])
returns integer language sql security definer set search_path=public as $$
 select greatest(0,5-coalesce(max(case when locked_until<=now() then 0 else failures end),0))::integer
 from together_login_limits where key=any(keys);
$$;
revoke all on function public.together_login_attempts_remaining(text[]) from public,anon,authenticated;
grant execute on function public.together_login_attempts_remaining(text[]) to service_role;
