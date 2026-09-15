# Wallet foundation — stage 1

## Apply

In the project's Supabase SQL Editor, create a new query, paste all of
`001-wallet-foundation.sql`, and Run once. It is a transaction: an error rolls
back the setup. The administrator must already be the verified account
zwelinnaing34@gmail.com; otherwise the transaction deliberately fails.
Do not rerun after success. Do not put a service-role key in Vite variables.

Refresh the website and open My account. Expect 0 points, 1 free session
available, and Administrator account. This stage does not charge for booths
or consume the trial. Charging and payment approval are later migrations.

## Verify before payments

- Sign in as the administrator: wallet appears and is still 0 on refresh.
- Sign in as a second verified account: 0 points, trial available, no admin label.
- Signed-out users cannot execute together_my_wallet.
- With each user's authenticated client, selects on together_accounts,
  together_credit_ledger and together_admins only expose that user's rows.
- Authenticated clients cannot insert, update or delete rows in these tables.
- Repeated wallet requests never create duplicate accounts or credits.

No credit-writing function is exposed in this stage. The next stage must
use atomic database transactions, locking the account row before a debit,
and unique operation references for payment approval and refunds. Never
deduct credits with browser-side read/modify/write operations.

## Pricing agreed

Currency MMK. One booth costs 100 points. Top-up: 7,000 MMK for 1,000 points.
One free session per account, tracked separately from purchased points.
For duo the creator pays; the guest is not charged.

## Remaining stages

Private receipt storage and top-up requests; admin review with one-time
crediting; session charging and trial consumption; failure/refund rules;
live tests with two users. Do not collect payments until these are verified.
