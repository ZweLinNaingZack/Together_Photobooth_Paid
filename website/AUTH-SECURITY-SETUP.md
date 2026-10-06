# Activate account security

Deployment does not automatically change hosted Supabase Auth settings.

1. Run `013-login-security.sql` in SQL Editor. Enable the **Password Verification** Auth hook and select `public.together_password_verification`. This protects accounts even when callers bypass the website gateway. Check hook availability on your plan; the custom policy is not fully active without this hook.
2. Apply the exact server policy with `node server/configure-password-policy.mjs --apply`, setting `SUPABASE_ACCESS_TOKEN` (a management token) and `SUPABASE_PROJECT_REF` in your local shell first. Without `--apply` it only previews. It sets length 8 and all four character groups, including precisely the requested symbols. Supabase then enforces signup and password updates even through direct API calls. Never commit the token or add it to VITE variables. The dashboard’s strongest default policy is a fallback with a broader symbol set. Keep email confirmation enabled.
3. Deploy the website. `/api/password-login` uses existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. It applies separate identifier and trusted Vercel IP limits. Google login is unaffected. Vite development hosts the same handler using local `.env` values; restart it after changing variables. Local tunnel requests share the tunnel connection IP; test distinct IP behavior on Vercel.
4. Run `014-immediate-email-dispatch.sql` after 011 and 012. Payment jobs wake the worker after commit; cron remains the retry fallback. The worker’s 600ms pacing between emails respects provider limits; the first email has no scheduling delay.

## Direct Resend authentication delivery

1. Deploy the Edge Function from this directory: `supabase functions deploy auth-email --no-verify-jwt`. JWT verification is replaced by signed webhook verification.
2. In Supabase Auth Hooks, create an HTTP **Send Email** hook at `https://PROJECT-REF.supabase.co/functions/v1/auth-email`. Save its signing secret in **Supabase Edge Function secrets** as `SEND_EMAIL_HOOK_SECRET`.
3. Add Edge Function secrets `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `SITE_URL`, and optional `EMAIL_LOGO_URL`. These are separate from Vercel variables. Use the exact verified sending domain. Supabase supplies `SUPABASE_URL`.
4. Enable the hook after deployment/secrets are ready. Keep Email provider enabled. Set Vercel `VITE_AUTH_EMAIL_FLOWS_ENABLED=true` and redeploy. Allow the production callback URL in Supabase.
5. Signup and recovery use the branded template. Supabase still generates/validates tokens. The hook immediately calls Resend REST and awaits provider acceptance, without arbitrary sleeps or SMTP handshakes. Inbox delivery and cold starts cannot be guaranteed instantaneous.
6. Inspect Supabase function logs and Resend delivery status on failure; never log tokens/request bodies. Disable the hook to restore existing SMTP delivery.

## Test before launch

- All five password requirements update live on signup/reset; weak passwords fail direct Supabase requests too.
- Five wrong passwords cause 429, and correct passwords remain blocked for five minutes. Refresh cannot bypass it. Success resets counts.
- Test the password hook directly against Supabase with a disposable account, not just through the gateway.
- Account Security sends reset mail and returns to the password form.
- Verify branded emails on mobile/desktop, expired and reused links, CAPTCHA, and Google sign-in.
- Payment emails start after commit; provider errors are retried by the queue.

Account lockouts can be maliciously triggered against a user; Google remains an alternative. Shared Wi-Fi users share the IP limit. Clean up limiter rows inactive for 30 days, retaining active locks/leases. Live provider delivery and hosted hook settings require live verification.

References: https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook ; https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook ; https://supabase.com/docs/guides/auth/password-security
