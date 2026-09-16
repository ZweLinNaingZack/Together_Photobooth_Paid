# Deploy Together to Vercel

The React website and `/api/rooms/[action]` run on Vercel. Supabase stores room
state, accounts, points and receipts. Cloudflare TURN still relays cameras when
needed. Cloudflare Tunnel and an awake laptop are no longer required.

## 1. Prepare Supabase

Keep the existing project. Run `004-hosted-rooms.sql` once in its SQL Editor.
This is independent of the payment migrations. If payments are being tested,
also apply any not-yet-applied 001, 002, 003 migrations in order. Never rerun an
already successful migration.

004 creates private room and rate-limit tables. Browsers cannot read them.
The Vercel server uses its server-only service-role key to access them. Room
messages contain connection metadata; photos/video are not stored in this table.
Rooms expire after 45 minutes and become unavailable if the host stops sending
heartbeats for over a minute. Expired rows are cleaned on new room creation.

## 2. Put the latest source in GitHub

Use your existing TogetherPhotobooth repository. Commit and push the latest
website changes, including `api`, `server/hosted-rooms.mjs`, `vercel.json`, the
client changes and lockfile. Do not commit `.env` files or secret keys.
No Git push or deployment was performed as part of this preparation.

## 3. Import the project

In Vercel choose Add New → Project → import TogetherPhotobooth from GitHub.

| Setting | Value |
|---|---|
| Root Directory | `website` |
| Framework Preset | Vite |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Node.js | 22.x |

Do not use the repository root or deploy only the dist folder: the API folder
must also be included. The app uses hash routes, so no catch-all rewrite is
needed. Do not add a rewrite that sends `/api/rooms/...` to index.html.

## 4. Set environment variables before Deploy

Add these in Vercel's Environment Variables for Production. Enable Preview too
only if you intend to test that environment against this Supabase project.

| Name | Value / source |
|---|---|
| `VITE_SUPABASE_URL` | Existing Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing browser-safe publishable key |
| `SUPABASE_URL` | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key from the API keys settings (server only) |
| `TURN_KEY_ID` | Existing Cloudflare TURN key ID |
| `TURN_KEY_API_TOKEN` | Existing Cloudflare TURN key API token |

Only the two VITE variables are public. Never add VITE_ to the other names.
Your Google client secret stays in Supabase; do not put it in website code.
Changing environment variables requires a redeployment.

## 5. Deploy and configure Google return URLs

Click Deploy. Use the stable production address from the project's Domains
page, for example `https://YOUR-PROJECT.vercel.app`, not a one-off deployment URL.

In Supabase → Authentication → URL Configuration:
- Site URL: `https://YOUR-PROJECT.vercel.app`
- Redirect URLs: `https://YOUR-PROJECT.vercel.app/#account`

Google Cloud's authorized redirect URI remains the Supabase callback URL shown
under Supabase's Google provider (ending `/auth/v1/callback`). It is not the
Vercel page. Make sure the Google provider is enabled in Supabase. If Google
OAuth is in Testing mode, add your testers under its audience/test-user settings.

## 6. Verify on the hosted site

1. With PowerShell/tunnel stopped, open the Vercel site on another device.
2. Check signed-out booth access shows the sign-in dialog.
3. Complete Google sign-in, refresh, and check My account and administrator status.
4. Create a duo room; join from another signed-in device by code, then test a
   separate session by invitation link. Both devices must use the Vercel site.
5. Mark both ready and check both live cameras on different networks (Wi-Fi/5G).
6. Capture and export a shared card. Verify mirror, countdown, flash and filters.
7. Close the host session and verify the guest sees the room end.
8. Verify a test top-up/receipt/review with accounts you control before payments.

If APIs return 503, check Vercel Functions logs and confirm 004 and the server
environment variables exist. If an API returns HTML, check the Root Directory
and rewrites. A 401 means the user must sign in. Camera relay errors require
checking the TURN credentials, not installing a tunnel.

## Local development and limitations

`pnpm dev` still runs the existing in-memory room server for local testing.
Local rooms and hosted rooms are separate. For testing the actual Vercel handler
locally, use `vercel dev` with the server environment configured.

Local tests cover shared PostgreSQL state, concurrent joins/signals, identity
checks, and room-token ownership. A real Vercel deployment and cross-network
camera test still need the manual checks above. Polling performs database reads
and writes; monitor Supabase and Vercel usage during testing and choose a function
region near the Supabase project in Vercel settings where supported.

Session charging/free-trial consumption remains unfinished. Hosting this build
does not enable paid-session enforcement. Use it as a test deployment for now.

Vercel Hobby is restricted to personal, non-commercial use. For this paid
business choose an appropriate commercial plan rather than assuming Hobby applies.

Official references:
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/plans/hobby
- https://supabase.com/docs/guides/auth/redirect-urls
