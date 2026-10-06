-- Enable pg_cron and pg_net in Supabase first. Add Vault secrets using the dashboard:
-- together_email_worker_url = https://YOUR-DOMAIN/api/payment-emails
-- together_email_worker_secret = same random value as EMAIL_WORKER_SECRET in Vercel
-- Run after deploying the protected endpoint and applying 011.
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='together_email_worker_url')
 or not exists(select 1 from vault.decrypted_secrets where name='together_email_worker_secret') then
  raise exception 'Add the two email worker Vault secrets first';
 end if;
end $$;
select cron.schedule('together-payment-emails','* * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='together_email_worker_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='together_email_worker_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=25000
 );
$job$);
