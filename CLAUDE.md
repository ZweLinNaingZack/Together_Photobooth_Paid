# CLAUDE.md — Together Photobooth

Read this first. It is the hand-off from the earlier Claude chat (9–11 Oct 2026) and the
working rules for this project. `PROJECT_SUMMARY.md` (same folder) has the longer history.

## About the owner (how to work with me)

- Zwe Lin Naing — frontend student developer, under 1 year of experience, learning by building.
- Keep answers **short and direct**. No long intros. Don't over-explain things I didn't ask about.
- In code: **clean, consistent, commented** (say what each part does and *why*).
- After code, give a **short plain-English explanation** so I learn.
- Prefer **simple solutions** over clever ones. Point out beginner mistakes kindly.
- If I'm going the wrong way, suggest a better path.
- I test locally first, then push. Ask before big or hard-to-undo changes.
- I use Windows (PowerShell) and VS Code. Give commands for PowerShell.

## Product

Together Photobooth — https://togetherphotobooth.xyz — online photobooth for long-distance
couples and friends. Solo or Duo (two people, live WebRTC cameras), layouts, frames, filters,
download/print a photocard. **Testing stage; planned paid launch** (points bought by manual
KBZPay transfer, admin approves). Operator: Zwe Lin Naing, Myanmar.

## Tech stack

- React 19 + TypeScript + **Vite 7** (NOT Next.js, NOT Tailwind). Hash routes: `#`, `#about`,
  `#contact`, `#terms`, `#privacy`, `#refunds`, `#account`, `#account/buy`, `#account/admin`, `#booth`.
- Supabase (Auth, Postgres, Realtime, Storage for receipts). Migrations are `website/0NN-*.sql`,
  run **by hand** in the Supabase SQL Editor (001–020).
- Vercel (site + `website/api/*` serverless functions). Cloudflare TURN for WebRTC relay.
  Resend for all email (payment emails via `api/payment-emails.mjs`).
- Package manager: **pnpm**. Tests: Node test runner + PGlite; Playwright browser tests for duo.

## Folder layout

The git repo root is this folder. The app lives in `website/`:
- `src/booth/` — booth flow (`Booth.tsx` is the coordinator), camera, duo (`useDuoPeer.ts`), recovery.
- `src/auth/` — sign-in, account, wallet, buy points (`Topups.tsx`; admin part stays English).
- `src/pages/` — Home, About, `Legal.tsx` (Terms/Privacy/Refunds/Contact), `legalText.ts` (policy words).
- `src/i18n/` — site translations (see below).
- `server/`, `api/` — room API, auth cache, password sign-in, payment emails.
- `tests/` — automated tests. `load/` — k6 load test (staging only).

## Commands (run inside `website/`)

```
pnpm install        # first time / after pulling
pnpm dev            # local preview (http://localhost:5173)
pnpm test           # all tests (should be 135 passing)
npx tsc --noEmit    # type check
pnpm build          # production build
```
Before saying a change is done: type check + tests + build must pass.

## Git + deploy workflow (important)

- Work on the **`staging`** branch → auto-deploys to the staging Vercel project
  (`together-photobooth-paid`, staging Supabase).
- Go live: `git checkout master; git merge staging; git push; git checkout staging`
  → production (togetherphotobooth.xyz, production Supabase). Live branch is **master** (not main).
- Don't push or merge to master unless I ask. Don't click/create GitHub pull requests.
- Git shows "LF will be replaced by CRLF" warnings on Windows — harmless.

## Security rules

- **Never** print, paste or commit secrets: Supabase keys, service role key, Resend key, TURN keys.
- `.env` and `.env.loadtest` stay local and git-ignored. The repo is currently **public**.
- Load-test scripts must only ever point at staging (`load/env.mjs` guards this).
- Admin access is by Supabase user id in `together_admins`, never by an email check in the client.

## Translations (added 10–11 Oct 2026)

- Whole site in **English, Burmese (`my`), Vietnamese (`vi`)**, except the admin reviews page.
- Words live in `src/i18n/en.ts` (source of truth), `my.ts`, `vi.ts` — same keys; TypeScript
  errors if a key is missing. Use `const t = useT(); t('key', { n: 3 })` in components.
- Text formatting inside strings: `*italic*`, `**bold**`, `[link](#page)`, `\n` → render with `<Rich text={...} />`.
- `tm(message)` translates known English messages from the server/helper files (exact match).
- Tone: friendly, young but polite. Burmese keeps common English words (booth, layout, frame,
  filter, points, session, upload, download, link, code, account). Policies stay formal.
- **When adding UI text, add it to all three files.** The language button is `components/LanguageSwitcher.tsx`.
- Policy pages use `src/pages/legalText.ts` (also 3 languages). Change rules in all three.
- First visit follows the phone language; a choice is saved in localStorage `together.lang`.

## Business rules (don't break these)

- 1 session = 100 points; each email (normalized Gmail mailbox) gets one free session first.
- Charged only when the user confirms editing; choosing a layout makes a 45-minute reservation.
- Duo: only the creator (host) pays. Points never expire, are non-refundable; errors → points re-added.
- Gmail-only accounts (sign-up hook, migration 007). Photos/video never go to our servers.
- Contact: togetherphotobooth.xyz@gmail.com · +84 911 017 625 · TikTok @togetherphotobooth.
  Facebook/Telegram cards say "Coming soon" — fill `CONTACTS` in `src/pages/Legal.tsx`.

## Status / open items (as of 11 Oct 2026)

Check with me which of these are done:
1. Push + test on staging, then merge to master: legal pages, contact page, translations.
2. New admin email: sign up with togetherphotobooth.xyz@gmail.com, run `020-new-admin-email.sql`
   on production, set Vercel `ADMIN_EMAIL` and `SUPPORT_EMAIL`, redeploy; later remove old admin.
3. Native speakers should proofread `my.ts` / `vi.ts` (Burmese font couldn't be checked in the cloud).
4. Change `LAST_UPDATED` in `src/pages/Legal.tsx` on launch day; get policies reviewed.
5. Confirm production Vercel function region matches Supabase.
6. Before launch: Vercel Pro (Hobby is non-commercial), Supabase Pro (backups), make repo private,
   remove committed `node_modules`, error alerts.
7. Optional: Server-Timing in the room API, H.264 preference, `replaceTrack` camera switch.
