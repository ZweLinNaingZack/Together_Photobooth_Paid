# Activate account security

Deployment does not automatically change hosted Supabase Auth settings.

## Free-plan deployment and email-link correction

- Run 013 for the website limiter, but **skip the Password Verification hook** on Free/Pro (Teams/Enterprise only). The gateway limits website logins; direct Supabase calls retain its native protections.
- Deploy the latest Vercel code first. Signup/password updates now pass through `/api/password-account`, which checks the exact password policy before forwarding to Supabase. It requires `SITE_URL`, `SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Keep Supabase password settings enabled too to prevent bypass through direct provider calls.
- Redeploy `auth-email` to Supabase after Vercel is ready. New signup/recovery emails point to the website and use `verifyOtp` after a user clicks **Verify and continue**. This avoids the same-browser PKCE dependency and prevents simple email-link scanners consuming tokens. OAuth continues using PKCE.
- Request a **new** email after both deployments. Old emails retain their old links. A previously confirmed account can simply sign in; no account deletion is required.
- Browser referrers are disabled and link tokens are removed from history during initialization. Do not log URL query strings containing email tokens in monitoring.

1. Run `013-login-security.sql` in SQL Editor. On Free/Pro, skip the Password Verification hook. Only on Teams/Enterprise, enable that hook and select `public.together_password_verification` to extend the policy to direct provider logins.
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
- On Teams/Enterprise with the password hook enabled, test it directly against Supabase with a disposable account. On Free, test the gateway limiter and document the direct-provider limitation.
- Account Security sends reset mail and returns to the password form.
- Verify branded emails on mobile/desktop, expired and reused links, CAPTCHA, and Google sign-in.
- Payment emails start after commit; provider errors are retried by the queue.

Account lockouts can be maliciously triggered against a user; Google remains an alternative. Shared Wi-Fi users share the IP limit. Clean up limiter rows inactive for 30 days, retaining active locks/leases. Live provider delivery and hosted hook settings require live verification.

References: https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook ; https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook ; https://supabase.com/docs/guides/auth/password-security
