# Step 2: KBZPay top-ups and manual review

Run `002-topups.sql` once in Supabase SQL Editor, after the successful wallet
migration. It creates a private receipt bucket and payment-request functions.
Do not rerun `001-wallet-foundation.sql`. No server secrets are needed in the browser.

Refresh My account. A 7,000 MMK package gives 1,000 points. The supplied QR is
copied unchanged to public/kbzpay-topup.png. Confirm it still scans in KBZPay
and shows the intended recipient and 7,000 MMK before using real payments.

## Live verification before accepting customer payments

Use a clearly marked test image/request and accounts you control. Do not ask
customers to transfer while testing. Test approvals add points: use a dedicated
test account and distinguish test bank references from real references.

1. As a non-admin verified user, start a request and refresh. The same request
   should remain, with no duplicate and no added points.
2. Upload a JPG/PNG/WebP under 5 MB and submit. It becomes Pending review.
3. Close the page and return to My account. The request remains visible.
4. On a second account, verify the first account's request and receipt cannot
   be viewed. Oversized and unsupported uploads should be rejected.
5. Sign in as administrator. Open Payment reviews and view the receipt.
6. Check the actual incoming transfer in KBZPay. For a test-only account use a
   clearly identified test reference. Enter the transaction reference, tick the
   verification box, and approve. The real customer's transfer reference must
   come from the bank, not solely the uploaded receipt.
7. Return to the user's account and refresh balance: +1,000 points exactly once.
   Retrying the same approval must not duplicate the credit.
8. Try a second approval with the same bank reference: it must fail and leave
   that request pending with no extra points.
9. Reject a separate test request with a reason. The user sees the reason;
   no points are added. A new request is then allowed.

Only one draft/pending request per account is allowed, with at most five new
requests per day. A request has one immutable receipt; a failed submission after
upload can be resumed with Submit saved receipt. Requests are not automatically
approved. Pending payments can wait overnight. Status/balance refresh buttons
read the latest database state; realtime subscription is not required.

Local automated tests execute both migrations in PGlite (PostgreSQL) with
minimal Auth/Storage schema fixtures. They cover ownership, write restrictions,
unverified accounts, repeated approvals and reused transfer references. They do
not exercise Supabase Storage HTTP upload validation, bank QR scanning, or live
browser sessions. Run the checks above after applying the migration.

Booth charging, free-trial consumption, refunds, receipt retention/cleanup and
launch-wide abuse protection are still separate steps. Booths remain uncharged
until the session charging stage is implemented and tested.
