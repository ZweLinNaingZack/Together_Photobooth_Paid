# Gmail login, CAPTCHA and session reservations

## Activate this update in order

1. Run `007-auth-and-reservations.sql` in the Supabase SQL Editor after 001–006.
   This preserves balances and consumed trials. Do not rerun earlier migrations.
2. Supabase → Authentication → Hooks → Before User Created: select the Postgres
   function `public.together_before_user_created` and enable it. Merely running
   the SQL does not activate the hook. It accepts new email/Google users with an
   exact gmail.com domain and rejects other providers. Existing users are not deleted.
3. Keep Email/password and Google providers enabled; leave Discord disabled.
   Keep **Confirm email enabled**. Supabase's verified-email identity linking
   retains one user for Google and password logins using the same verified email.
   Gmail aliases share trial eligibility but are not silently merged as accounts.

## Create Turnstile (no purchased domain needed for the Vercel hostname)

1. Open Cloudflare Dashboard → Turnstile → Add widget.
2. Name it `Together sign-in`. Add your actual Vercel hostname without `https://`
   or a path. Add only additional hostnames you test, such as localhost.
3. Choose **Managed** mode and create it. Copy the site key and secret key.
4. Vercel project → Settings → Environment Variables: add the public site key as
   `VITE_TURNSTILE_SITE_KEY`. Set the same value in local `.env` for local testing.
5. Supabase → Authentication settings → Bot and Abuse Protection → CAPTCHA:
   enable CAPTCHA, select Cloudflare Turnstile, paste the **secret key**, save.
   Never put the secret key in a VITE variable or in Git.
6. Add `VITE_AUTH_EMAIL_FLOWS_ENABLED=false` to Vercel. Push changes and redeploy
   so Vite incorporates the public site key. Set production/preview values for
   each environment being tested; authorize their hostnames in Turnstile.

The app submits the CAPTCHA token to Supabase for verification. Without a site
key, password sign-in fails closed with a setup message; Google remains available.
Expired challenges are cleared. Each submitted password/email request gets a fresh
challenge. Supabase's CAPTCHA setting is essential: the UI alone cannot enforce it.
Keep Supabase Auth rate limits enabled; do not raise them to work around bot errors.
Review the configured sign-up/sign-in IP limits in Bot and Abuse Protection during
testing. The database separately limits successful reservation attempts to 20/minute
per normalized mailbox and permits only one active reservation per account.

## What can be tested now

- Existing confirmed Gmail accounts with a password: normal password login.
- Google Gmail users: login and new account creation without confirmation emails.
- Exact same verified email through both login methods: same Supabase user ID,
  balance and trial history. A Google-only account does not yet have a password;
  continue with Google until password setup/recovery is enabled later.
- Server-side hook rejection for Outlook, Yahoo, iCloud and Discord new users.
- First trial reservation, cancellation, expiry, completion, and alias reuse.
- Paid booth with 100 points; second concurrent booth is refused. Completion
  deducts once; cancel before completion releases the hold.
- Duo: only the creator reserves/pays; the server checks the creator's ticket
  before issuing camera relay settings to either participant. Guest balance is irrelevant.

Reservations expire after 45 minutes. Normal navigation releases them immediately;
if the tab crashes before the release reaches Supabase, expiry releases the hold.
Retakes in a completed booth do not charge again. Old builds should be refreshed
after migration: completion now requires an earlier reservation.
Use Vercel or `vercel dev` for duo tests; the legacy in-memory Vite room server
does not populate the database used by reservation checks.

## Later: Resend

Registration, resend-confirmation and reset requests remain paused in the UI while
`VITE_AUTH_EMAIL_FLOWS_ENABLED=false`; no email is requested by those buttons.
This UI flag is not a Supabase API restriction. Keep confirmation required so
direct email signups cannot claim trials without verifying their address.
After acquiring/verifying a sending domain, configure Resend as Supabase custom
SMTP, verify sender and redirect URLs, then set that flag to true and redeploy.
Keep the Resend/SMTP secret only in Supabase. No auth provider or user migration
is needed. Test signup confirmation, password reset, CAPTCHA and delivery then.

Limits: multiple genuine Gmail inboxes can still receive separate trials. The
server authorizes and accounts for sessions, but local camera capture/rendering
remains client-side and is not a tamper-proof export/paywall system.

Official setup references:
- https://developers.cloudflare.com/turnstile/get-started/
- https://supabase.com/docs/guides/auth/auth-captcha
- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- https://supabase.com/docs/guides/auth/auth-identity-linking
