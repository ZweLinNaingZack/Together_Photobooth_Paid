# Enable the faster duo connection

The camera handshake now prefers a private Supabase Realtime WebSocket. Video
and photos still travel through encrypted WebRTC, directly or through Cloudflare
TURN. The room HTTP API remains a fallback when WebSockets are unavailable.

## Deploy in this order

1. In the existing Supabase project's SQL Editor, run `008-camera-realtime.sql`.
   Migrations 001–007 must already be installed. This adds authorization policies
   for the room's authenticated participants; it does not expose room tables.
2. In Supabase Realtime Settings, disable **Allow public access**. This application
   only creates private camera channels. Do not add broad public broadcast policies.
3. Push the application changes to GitHub and wait for the Vercel production
   deployment to finish. No new environment variables or paid provider is required
   to configure this transport; normal provider quotas/usage still apply.
4. Reload the website on both devices and create a **new** booth. Existing rooms
   created before this update do not have the new channel identifier.
5. Open **Connection details** on both devices. **Transport: Private WebSocket**
   confirms subscription. **HTTP fallback** means the fast transport is unavailable;
   verify step 1, project configuration, and whether the network blocks WebSockets.

## What changed

- Offers, answers and ICE candidates use WebSocket delivery instead of waiting
  for repeated Vercel/Auth/PostgreSQL requests.
- The other browser acknowledges delivery. Missing acknowledgements trigger
  persisted HTTP delivery; duplicates are ignored.
- Relay credentials load while camera permission/device startup is in progress.
  Fetching these credentials no longer competes with room writes.
- Replayed older handshakes cannot replace a newer negotiation.
- Automatic retries explicitly use TURN after the first direct attempt fails.
- Diagnostics include transport, selected network route, round-trip time and
  per-attempt connection time. They exclude credentials, SDP and IP addresses.

## Verify on real devices

Test host-first and guest-first arrivals, a fresh device granting camera permission,
same-Wi-Fi devices, and one device on mobile data. Try at least five joins in each
case. Check both videos, manual/timed photos, photo transfer, and export.
Check that returning after a temporary interruption recovers, and leaving still
ends the session appropriately. Check a normal nonparticipant cannot subscribe.

The 2–3 second goal starts once both cameras are permitted and ready. Local unit
tests validate delivery and authorization, not real internet connection times.
Actual setup time still depends on camera permissions, hardware startup, Supabase
and Vercel latency, and TURN reachability. No fixed connection time is guaranteed.

References:
- https://supabase.com/docs/guides/realtime/authorization
- https://supabase.com/docs/guides/realtime/broadcast
- https://developers.cloudflare.com/realtime/turn/generate-credentials/
