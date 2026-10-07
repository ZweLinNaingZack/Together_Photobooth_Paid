# Payment notifications

Implemented: receipt or transaction-reference submission → pending order → queued admin email; admin approval/rejection → queued customer email. Existing ledger credits remain atomic and idempotent. No emails are sent by the browser. No historical orders are emailed automatically.

## Activate

1. Apply  011-payment-emails.sql` in Supabase SQL Editor after migrations 001–010.
2. In Vercel Production add server-only environment variables:
   - `RESEND_API_KEY`: sending key authorized for the exact sender domain.
   - `EMAIL_FROM`: `Together Photobooth <noreply@YOUR-VERIFIED-DOMAIN>`.
   - `ADMIN_EMAIL`: destination for submitted payment notifications.
   - `SUPPORT_EMAIL`: an inbox you actually monitor (also used as Reply-To).
   - `SITE_URL`: your canonical HTTPS website origin. Check the one-r/two-r spelling; do not copy an old domain accidentally.
   - `EMAIL_WORKER_SECRET`: a long random secret, at least 32 random bytes.
   - Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Optional `EMAIL_LOGO_URL`: publicly hosted HTTPS PNG. Defaults to `/email-logo.png` on SITE_URL.
   Never prefix these secrets with VITE_. The Resend key in Supabase SMTP is separate configuration and does not configure this worker.
3. Deploy to Vercel. The worker is `POST /api/payment-emails`, protected by `Authorization: Bearer EMAIL_WORKER_SECRET`.
4. Enable Supabase `pg_cron` and `pg_net` extensions. In Supabase Vault add:
   - `together_email_worker_url`: `https://YOUR-DOMAIN/api/payment-emails`.
   - `together_email_worker_secret`: the same worker secret.
5. Run `012-email-scheduler.sql`. It wakes the worker every minute. No browser or laptop needs to stay open. Endpoint must be accessible to the scheduler, without Vercel preview/deployment protection blocking it.
6. Submit a controlled payment request, check the admin email, sign in through its link, verify the bank transfer, then approve. Confirm the points and customer email. Test rejection separately. Do not approve nonexistent transfers in production just to test emails.

## Review links

Approve/Reject links open the selected order in the admin dashboard; neither link changes data. Administrators must check the transfer and explicitly approve or reject. The customer note is optional. Run `017-optional-review-reference.sql` in Supabase SQL Editor before deploying the updated dashboard: it removes the required bank reference while retaining authorization, atomic crediting, repeat-approval protection and email notifications. Without a supplied bank reference, matching duplicate transfers across separate orders is a manual review responsibility. Receipt URLs are created only after admin authentication and expire after five minutes. Reference-only orders do not require an image.

## Reliability and monitoring

- Deferred database trigger records the committed balance after approval. Order status, ledger credit, and email job succeed or roll back together.
- Jobs have unique order/event keys, leased claims, immutable message bodies, and Resend idempotency keys. Email sending cannot add credits.
- Worker processes up to five emails per minute by default. At higher volumes, adjust the scheduler/worker throughput to your provider limits; monitor queued job age rather than promising instant delivery.
- Retryable failures back off; up to eight attempts. Ambiguous retries stop after 23 hours, inside Resend's 24-hour deduplication window. Failed jobs need operator review; do not blindly reset old jobs, since an earlier attempt may have reached the recipient.
- Inspect `together_email_jobs` in the Supabase SQL Editor: status, attempts, provider_id, last_error, available_at. Ordinary users cannot read or mutate this table.
- `sent` means accepted by Resend, not guaranteed inbox delivery. Check Resend logs for delivery, bounce, and complaints. Webhook delivery tracking is not included.
- If an email fails, the payment and credits remain correct. Reconcile provider logs before any manual resend. The job stores a recipient/content snapshot for consistent retries; restrict database access and include this data in your retention policy.

## Templates

`server/payment-email.mjs` returns inline-styled HTML plus a plain-text accessibility fallback. Uses application colors, a 600px card, status badges, order totals, authenticated review links, and support details. `tests/preview-payment-emails.mjs` renders desktop/mobile previews without sending mail.

Supabase signup/password-reset emails still use Supabase SMTP and its configured templates. Payment notifications do not replace or bypass authentication email generation.
