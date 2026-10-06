-- Run after 011 and 012. pg_net dispatches after commit; cron remains the retry fallback.
create or replace function public.together_wake_email_worker()
returns trigger language plpgsql security definer set search_path=public as $$
declare endpoint text; secret text;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='together_email_worker_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='together_email_worker_secret';
 if endpoint is not null and secret is not null then
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=25000);
 end if;
 return new;
exception when others then
 -- A dispatch outage must not roll back a payment. The durable queue and cron retry it.
 return new;
end $$;
revoke all on function public.together_wake_email_worker() from public,anon,authenticated;
drop trigger if exists together_email_wakeup on public.together_email_jobs;
create trigger together_email_wakeup after insert on public.together_email_jobs for each row execute function public.together_wake_email_worker();
