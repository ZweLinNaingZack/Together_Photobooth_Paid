# Payments playbook: pause now, switch back on later

Together launched with paid sessions (points bought by KBZPay transfer, approved by an admin).
For the free promotion (until **31 December 2026**), payments are **paused, not removed**.
Everything below stays in the code and the database, so turning payments back on is a
checklist, not a rebuild.

> This file contains no secrets. Keys live only in Vercel and Supabase settings.

---

## 1. How the paid system works

### Business rules
| Rule | Value |
|---|---|
| Price | **7,000 MMK = 100 points** (buy 100 to 10,000 points, in steps of 100) |
| One session | **100 points** |
| Free first session | One per Gmail mailbox (dots and `+tags` are ignored, so it can't be farmed) |
| When points are taken | Only when the person taps **"Confirm & use points"** before editing |
| Choosing a layout | Makes a **45-minute reservation**: nothing is taken yet |
| Duo booths | Only the **creator (host)** pays; the guest is covered |
| Retakes / downloads | Included once the session is confirmed |
| Points | Never expire, non-refundable; if something fails on our side, points are re-added |

### The customer's journey
1. **Account → Buy points**: choose an amount; the price in MMK is shown.
2. Pay by **KBZPay** using the QR code (`public/kbzpay-payment.jpg`, `public/kbzpay-topup.png`).
3. Upload the **receipt screenshot** (and optionally the payment reference), then submit.
4. Wait for approval. An email arrives when points are added (or if the payment was rejected).
5. In the booth, confirming editing uses the free session first, then 100 points.

### The admin's journey
1. A **"Payment awaiting review"** email arrives at `ADMIN_EMAIL` with Approve / Reject links.
2. The links open **Account → Admin reviews** (`#account/admin`). Opening an email never approves anything.
3. Check the receipt and the KBZPay app, then **Approve** (points are credited instantly) or **Reject** with a reason.
4. Admins are listed by **user ID** in the `together_admins` table (never by email in the browser).

---

## 2. What it's made of (inventory)

### Database (Supabase, migrations in this folder)
| Migration | Payment-related pieces |
|---|---|
| `001-wallet-foundation.sql` | `together_accounts`, `together_credit_ledger` (every point in/out), `together_admins`, `together_my_wallet()` |
| `002-topups.sql` | `together_topups` (orders), `together_start_topup()`, `together_submit_topup()`, `together_review_topup()`, private storage bucket **`together-receipts`** (5 MB, JPG/PNG/WebP) |
| `003`, `009`, `010`, `017` | Pricing rule (7,000 MMK per 100), variable amounts, editing a draft order, optional payment reference |
| `005-session-charges.sql` | `together_sessions`, first version of `together_complete_session()` |
| `006-admin-order-identities.sql` | `together_admin_orders()`: admin-only list with customer names/emails |
| `007-auth-and-reservations.sql` | Gmail-only sign-up hook, `together_trial_mailboxes`, `together_reservations`, **`together_session_action()`** (reserve: checks the free session / 100-point balance) and **`together_complete_session()`** (takes the points) |
| `011-payment-emails.sql` | `together_email_jobs` queue + functions that queue an email when an order is submitted/approved/rejected |
| `012-email-scheduler.sql` | **pg_cron** job `together-payment-emails` (every minute) calling the email worker |
| `014-immediate-email-dispatch.sql` | **pg_net** trigger that wakes the worker right after a payment change |
| `016`, `019` | Resume a paid session; find your own unfinished reservation |

Supabase **Vault secrets** used by the email jobs: `together_email_worker_url`
(= `https://togetherphotobooth.xyz/api/payment-emails`) and `together_email_worker_secret`
(= the same value as `EMAIL_WORKER_SECRET` in Vercel).

### Server (Vercel)
| File | Job |
|---|---|
| `api/payment-emails.mjs` | Email worker: claims queued jobs, sends through Resend, retries safely |
| `server/payment-email.mjs` | The email template (pending / approved / rejected) |

Vercel environment variables: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `SUPPORT_EMAIL`,
`SITE_URL`, `EMAIL_WORKER_SECRET`, optional `EMAIL_LOGO_URL`.

### Website
| File | What it shows |
|---|---|
| `src/auth/Topups.tsx` | Buy points, KBZPay QR, receipt upload, **admin reviews** |
| `src/auth/Wallet.tsx` | Balance and history |
| `src/auth/GoogleAccount.tsx` | Account tabs: Overview / Buy points / Admin |
| `src/booth/useSessionCharge.ts` | Reserve → confirm → charge, resume |
| `src/booth/Booth.tsx` | "Ready to start editing?" confirmation dialog |
| `src/i18n/en.ts`, `my.ts`, `vi.ts` | ~30 texts mention points (`topup.*`, `wallet.*`, `booth.confirm.*`, FAQ, instructions) |
| `src/pages/legalText.ts` | Terms + **Refund Policy** (points, KBZPay, non-refundable), in 3 languages |

Setup guides with more detail: `WALLET_SETUP.md`, `TOPUP_SETUP.md`, `PAYMENT-EMAIL-SETUP.md`.

---

## 3. Pausing payments (free period)

**Principle:** keep every table, function and file. Only the *behaviour* changes, behind one switch.

**The switch** is built by `021-free-mode.sql`: one row in `public.together_settings`.
```sql
-- see it
select free_mode, free_until from public.together_settings;
-- payments OFF (free)                       -- payments back ON
update public.together_settings              update public.together_settings
  set free_mode = true,  updated_at = now();   set free_mode = false, updated_at = now();
-- change the "Free until" date shown on the site (it does not switch anything by itself)
update public.together_settings set free_until = '2027-01-31', updated_at = now();
```
The website reads the same switch (`together_free_mode()`, used by `src/auth/freeMode.ts`), so the
words on screen and what the database charges always match. A booth reserved while free stays free
even if the switch is turned off halfway through someone's session.

While free, the website automatically: shows a "Free until …" badge on the home page, changes the FAQ
and booth wording, hides **Buy points** (the admin reviews tab stays), shows a free notice at the top of
Terms / Privacy / Refunds, and shows the **"Buy me a coffee"** KBZPay card after the download
(`public/kbzpay-payment.jpg`, the open-amount QR). When the switch is off, all of that disappears
and the paid wording comes back on its own.

| Part | During the free period |
|---|---|
| Points balances & history | **Kept untouched.** Anyone who bought points keeps them for later. |
| Database functions | Kept. A "free mode" switch makes sessions cost 0 and skips the balance check. |
| Buy points page & admin reviews | Hidden from the menu (code kept). |
| KBZPay QR / receipts bucket | Kept. |
| Payment emails, cron job, Vault secrets | Kept running; with no new orders they simply do nothing. |
| Booth confirm dialog | "Start editing" with no points wording. |
| FAQ, instructions, policies | Updated to say "free until 31 Dec 2026"; Refund Policy notes that no payments are taken. |

> ⚠️ Pending orders: before pausing, approve or reject every order still waiting in Admin reviews.

---

## 4. Switching payments back on: checklist

Do these on **staging first**, test, then on production.

**Accounts & money**
- [ ] Vercel **Pro** plan (Hobby is for non-commercial use only)
- [ ] Supabase **Pro** plan (daily backups, because points are customers' money)
- [ ] KBZPay QR still valid → replace `public/kbzpay-payment.jpg` / `kbzpay-topup.png` if it changed
- [ ] Decide the price (still 7,000 MMK / 100 points?) → if it changes, it lives in the database
      check constraint (`009-variable-topups.sql`) **and** `Topups.tsx`. Write a new migration, never edit old ones.
- [ ] Decide if the free first session stays

**Switch**
- [ ] Turn free mode **off**: `update public.together_settings set free_mode = false, updated_at = now();`
      (run on staging first). Buy points, the paid wording and the policies' paid text come back by themselves.

**Words**
- [ ] Read the paid FAQ / instructions / booth texts once more; prices or rules may have changed
- [ ] Review Terms + Refund Policy for the paid period; update `LAST_UPDATED` in `src/pages/Legal.tsx`
- [ ] Announce it (TikTok, site banner) at least a week ahead

**Emails**
- [ ] `ADMIN_EMAIL` and `SUPPORT_EMAIL` in Vercel are the Together Gmail
- [ ] Vault secrets and the `together-payment-emails` cron job still exist (Supabase → Integrations → Cron)
- [ ] Resend domain still verified

**Test (staging)**
- [ ] New account: free first session works, second session asks for points
- [ ] Buy 100 points → upload a receipt → admin email arrives → approve → customer email arrives → balance 100
- [ ] Use a session → balance 0 → next session blocked with "top up" message
- [ ] Reject an order → customer gets the rejection email with the reason
- [ ] Duo: only the host is charged
- [ ] `pnpm test` passes (the payment SQL is covered by `tests/payments.test.mjs`)

---

## 5. Gotchas we already hit

- **Migrations run by hand, in order**, in the Supabase SQL Editor. Never edit an old migration;
  add a new numbered one.
- **Admins are user IDs** in `together_admins`. `020-new-admin-email.sql` shows how to add one.
- **Auth email function** must be deployed with `npx supabase functions deploy auth-email --no-verify-jwt`,
  or sign-up/reset emails stop.
- **Supabase email rate limit**: set *Authentication → Rate Limits → emails per hour* to 100+ before
  a busy launch; the default is very low.
- **Never put a service-role key in a `VITE_` variable**: those are visible in the browser.
