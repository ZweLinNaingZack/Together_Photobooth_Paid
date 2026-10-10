# Together Photobooth — Project Summary

_Last reviewed: 11 October 2026_ · Working rules for Claude Code are in `CLAUDE.md`.

## Product

Together Photobooth (https://togetherphotobooth.xyz) is a browser-based photobooth for making personal photo cards, alone or with another person — built for people in long-distance relationships. Users choose a layout, take or upload photos, choose artwork and a photo filter, adjust crops, then download or print the finished card. The interface uses a warm cream-and-sage palette, DM Sans typography, and mobile-focused controls. The site is available in English, Burmese and Vietnamese. Status: testing stage, not yet public; planned launch as a paid product.

## Technology and architecture

- **Frontend:** React 19 with TypeScript, built and served by Vite 7 (not Next.js; no Tailwind). Client-rendered SPA with hash navigation (`#`, `#about`, `#contact`, `#terms`, `#privacy`, `#refunds`, `#account`, `#booth`). The guided booth flow keeps its current step and photo-card state in `Booth.tsx`.
- **Languages:** `src/i18n/` — `en.ts` (source of truth), `my.ts` (Burmese), `vi.ts` (Vietnamese), same keys checked by TypeScript; `useT()`/`t()`, `<Rich>` for *italic*/**bold**/links, `tm()` for known server messages. Burmese/Vietnamese load only when chosen. Language button in the top bar; first visit follows the phone language. Policy text in `src/pages/legalText.ts` (3 languages).
- **Photo processing:** Browser camera/media APIs, WebRTC, Canvas rendering, and a Web Worker for filters. Duo still photos travel between participants over a WebRTC data channel. Photos and video are never sent through the room API or saved to a server.
- **Backend and database:** Supabase Auth and PostgreSQL (production project "Together Photobooth"; separate staging project for load tests). Supabase Realtime Broadcast is used for authorized camera signaling.
- **Server APIs / hosting:** Vercel hosts the site and API routes (hosted rooms, account/password support, payment emails). Cloudflare TURN provides relay credentials for WebRTC.
- **Branches and deployments:** GitHub `ZweLinNaingZack/Together_Photobooth_Paid` (public).
  - `master` → **production** Vercel project (togetherphotobooth.xyz, production Supabase).
  - `staging` → **staging** Vercel project `together-photobooth-paid` (tracks `staging`; staging Supabase; Deployment Protection off; no Turnstile key, so website password sign-in is disabled there).
  - Workflow: work and test on `staging`; go live with `git checkout master && git merge staging && git push && git checkout staging`.
  - **Vercel function region must match the Supabase region** (load tests showed ~5× slower API otherwise).
- **Email:** Resend sends all email. Payment emails use Vercel env `ADMIN_EMAIL` (new-payment alerts), `SUPPORT_EMAIL` (reply-to), `EMAIL_FROM` (must be the Resend domain sender).
- **Payments:** Manual admin approval of KBZPay top-ups (7,000 MMK = 100 points). One booth session costs 100 points (free session first). In duo, only the host pays. Admin = row in `together_admins` (by user id).
- **Accounts:** Gmail addresses only (sign-up hook from migration 007), Google sign-in or email/password with email confirmation.
- **Device recovery:** IndexedDB holds the paid editing draft (key = user id) and the active pre-edit "Your photos" session (key = `<user id>:active`). Neither is cloud photo storage.
- **Tests:** Node's test runner (135 tests incl. PGlite SQL tests); Playwright real-WebRTC duo browser tests (run with `pnpm dev` running); k6 load test in `website/load/` against staging.

## Key design decisions

1. **Keep photos on participants' devices.**
2. **Separate signaling from media.**
3. **Charge only when users confirm editing.** Choosing a layout creates a 45-minute reservation (no deduction).
4. **Use a guided, step-based flow** with browser history and leave-protection dialogs.
5. **Use supplied artwork as artwork;** one Canvas renderer for preview and export.
6. **Favor usable mobile controls.**
7. **Retain tested JavaScript photo logic alongside TypeScript UI.**
8. **Flow over preview quality:** cameras must connect and photos must reach Frame & filter.
9. **Translations live in dictionaries, not in components;** English is the version that counts for policies.

## Work done 9–10 Oct 2026 (live on `master` as of 10 Oct)

- Session recovery for Solo and Duo (`019-active-session-lookup.sql`, `ActiveBoothDialog.tsx`, `BoothInProgress.tsx`).
- Camera choice: Front (default) / Back (main lens).
- Duo connection reliability (smaller photos, stall-based timeouts, gentler reconnection).
- Room API speed: 50/50 booths in the staging load test, 0 errors. Details in `claude/LAUNCH_TRAFFIC_REVIEW.md`.

## Work done 10–11 Oct 2026 (saved locally; check it is pushed/merged)

- **Policy pages:** Terms of Service, Privacy Policy, Refund Policy (`#terms`, `#privacy`, `#refunds`) in 3 languages; footer links; agreement line on sign-in; refund note on Buy points. Technology provider names removed from the policies at the owner's request.
- **Contact page** (`#contact`): phone, email, TikTok; Facebook/Telegram "Coming soon" (fill `CONTACTS` in `src/pages/Legal.tsx`).
- **New admin/support email** togetherphotobooth.xyz@gmail.com: `020-new-admin-email.sql` + Vercel `ADMIN_EMAIL`/`SUPPORT_EMAIL` (steps pending).
- **Whole site translated** into Burmese and Vietnamese (792 texts each), friendly tone; Home/About copy refreshed to match the current product.

## Remaining work and known gaps

- Push and test the 10–11 Oct work on staging, then merge to master.
- Admin email switch steps (sign up new Gmail, run 020, set Vercel env, redeploy, later remove old admin).
- Native speakers proofread `my.ts` and `vi.ts`; update policy `LAST_UPDATED` on launch day; have policies reviewed.
- Confirm the **production** Vercel function region matches Supabase.
- Launch preparation: Vercel Pro, Supabase Pro, configurable 500-room cap, error alerts.
- Hygiene: `node_modules` is committed to git; decide whether the repo should be private.
- Optional: `Server-Timing` measurements; H.264, `replaceTrack()`, synchronized shutter; per-booth diagnostics.
- Payment emails are English only.

## Main project locations

Local folder: `C:\Users\Zwe Lin Naing\Documents\ChatGPT\Online photobooth`.

- `website/src/booth/Booth.tsx` — booth state, steps, billing boundary, recovery, navigation.
- `website/src/booth/SessionScreen.tsx`, `useDuoPeer.ts`, `useRoom.ts`, `duoCaptures.mjs` — capture, duo connection, photo sync.
- `website/src/booth/recoveryStore.js`, `useSessionCharge.ts` — device recovery; reservation/charging.
- `website/src/i18n/` — translations; `website/src/components/LanguageSwitcher.tsx` — language button.
- `website/src/pages/Legal.tsx`, `legalText.ts` — policies and contact page.
- `website/server/`, `website/api/` — server APIs.
- `website/load/` — k6 load test (settings in git-ignored `website/.env.loadtest`).
- `website/*.sql` — Supabase migrations (001–020).
- `website/tests/` — automated tests.

## Local commands

From `website/`: `pnpm dev`, `pnpm test`, `npx tsc --noEmit`, `pnpm build`. Load test: `node load/seed-accounts.mjs`, `k6 run -e BOOTHS=50 load/booths.js`, `node load/cleanup.mjs`.
