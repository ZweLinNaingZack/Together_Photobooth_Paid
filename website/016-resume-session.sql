-- Read-only proof of a completed charge. Never creates a new reservation or debit.
create or replace function public.together_resume_session(request_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('session_id',id,'completed',true,'used_trial',used_trial)
 from public.together_sessions where id=request_id and user_id=auth.uid();
$$;
revoke all on function public.together_resume_session(uuid) from public,anon;
grant execute on function public.together_resume_session(uuid) to authenticated;
