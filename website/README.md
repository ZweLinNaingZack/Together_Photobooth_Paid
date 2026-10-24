# Together: website

This folder is the Together Photobooth web app (React 19 + TypeScript + Vite 7).
The project overview, features, tech stack and screenshots are in the
[main README](../README.md).

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in your own values
pnpm dev               # http://localhost:5173
pnpm test              # automated tests
pnpm build             # production build
```

## Setup guides

| Guide | Covers |
|---|---|
| [AUTH_SETUP.md](AUTH_SETUP.md) | Google and email sign-in |
| [AUTH-SECURITY-SETUP.md](AUTH-SECURITY-SETUP.md) | Branded auth emails (Resend) and sign-in protection |
| [AUTH_PROTECTION_SETUP.md](AUTH_PROTECTION_SETUP.md) | Captcha and rate limits |
| [WALLET_SETUP.md](WALLET_SETUP.md) / [TOPUP_SETUP.md](TOPUP_SETUP.md) | Points wallet and top-ups |
| [PAYMENT-EMAIL-SETUP.md](PAYMENT-EMAIL-SETUP.md) | Payment notification emails |
| [ROOMS.md](ROOMS.md) / [DUO-CONNECTION-SETUP.md](DUO-CONNECTION-SETUP.md) | Duo booth rooms and camera connection |
| [TURN-SETUP.md](TURN-SETUP.md) | Cloudflare TURN relay |
| [VERCEL_SETUP.md](VERCEL_SETUP.md) | Hosting and environment variables |
| [load/README.md](load/README.md) | Load testing (staging only) |

Database migrations are the numbered `0NN-*.sql` files in this folder. Run them in
order in the Supabase SQL Editor.
