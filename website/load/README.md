# Load test: many duo booths at once

These scripts imitate real duo booths (a host and a guest each) against a **staging** copy of the site. They measure whether the room API and database stay fast and error-free as booths are added. Video isn't simulated: it goes phone to phone and never touches these servers.

> Never point these scripts at the real project. `env.mjs` refuses to run if the staging Supabase URL matches the one in `website/.env`.

## One-time setup

**Staging Supabase project**
1. Create a new Supabase project (for example `Together Photobooth Staging`) in the same region as production.
2. In the SQL Editor, run `001` → `019` in order. **Skip `012` and `014`** (email scheduling; they need email secrets). Skip the Auth Hook step mentioned in `007`.
3. Authentication settings: make sure CAPTCHA protection is **off**, and raise the sign-in rate limit (for example 1000 per hour). All test sign-ins come from one computer.

**Staging Vercel project**
4. Add New → Project → the same GitHub repo, named for example `together-photobooth-staging`. Use the same Root Directory as production.
5. Environment variables, all from the **staging** Supabase project:
   - `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL` (the staging address)
   - `VITE_AUTH_EMAIL_FLOWS_ENABLED=false`
   - `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` (the production values are fine)
   - Leave `VITE_TURNSTILE_SITE_KEY` empty.
6. Deploy, then open the staging URL and check that the home page loads.
7. Settings → **Deployment Protection**: turn off Vercel Authentication for this staging project. Otherwise every API call gets a login page.

**Your computer**
8. Install k6 (PowerShell): `winget install k6 --source winget`, then check with `k6 version`.
9. Node 18 or newer (you already use it for `pnpm`).
10. Create `website/.env.loadtest`. Git ignores it through the `.env.*` rule. Never paste these values into chat.
    ```
    STAGING_SITE_URL=https://your-staging-url.vercel.app
    STAGING_SUPABASE_URL=https://xxxx.supabase.co
    STAGING_SUPABASE_PUBLISHABLE_KEY=...
    STAGING_SUPABASE_SERVICE_ROLE_KEY=...
    LOADTEST_PASSWORD=a-long-random-password
    ```

## Running a test (from `website/`)

| Step | Command | What it does |
|---|---|---|
| 1 | `node load/seed-accounts.mjs` | Creates 60 host/guest pairs (`load-host-001@example.com` …), already verified. Hosts get 10,000 test points. Safe to run again. |
| 2 | `k6 run -e BOOTHS=2 load/booths.js` | Quick check: 2 booths, about 11 minutes. To shorten it, add `-e HOLD=60`. |
| 3 | `k6 run -e BOOTHS=50 load/booths.js` | The real test: ramps up to 50 booths over 5 minutes, then each booth stays 10 minutes. |
| 3b | `k6 run -e BOOTHS=50 -e SPIKE=10 load/booths.js` | Same, plus 10 booths created at the same moment mid-test. |
| 4 | `node load/cleanup.mjs` | Deletes all test rooms, reservations, sessions, points and accounts. |

Options: `HOLD` (seconds each booth stays, default 600), `RAMP` (seconds to start all booths, default 300), `RTC=0` (skip relay credentials), `STATE_EVERY` (check-in seconds once both are ready; default 4 like the app, `1.5` reproduces the old app).

While step 3 runs, keep open:
- **Supabase (staging) → Reports:** database CPU, connections, API requests.
- **Vercel (staging) → Observability:** function errors and response times.

## Reading the result

The summary printed at the end shows:
- **Booths completed:** booths that got all the way to "confirm editing" and left cleanly. Goal: over 99%.
- **Failed requests:** goal under 1%.
- **"Booth busy" conflicts:** host and guest check-ins colliding on the same room record. Goal: 0.
- **Rate limited (429) / Server errors (5xx):** goal 0.
- **Response times by step:** typical / slowest 5% / worst. Check-ins (`state`) should stay under 1 second for the slowest 5%.
- **Goals:** PASS / FAIL for the targets above.

The full data is also saved as `load/results-<time>.json`. Git ignores it.

Each run makes about 1,000 server calls per booth. These count toward your Vercel monthly allowance, so avoid repeating the 50-booth run many times on the Hobby plan.
