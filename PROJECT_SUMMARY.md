# Together Photobooth — Project Summary

_Last reviewed: 9 October 2026_

## Product

Together Photobooth is a browser-based photobooth for making personal photo cards, alone or with another person. Users choose a layout, take or upload photos, choose artwork and a photo filter, adjust crops, then download or print the finished card. The interface uses a warm cream-and-sage palette, DM Sans typography, and mobile-focused controls.

## Technology and architecture

- **Frontend:** React 19 with TypeScript, built and served by Vite 7. The app is a client-rendered single-page application with hash navigation (`#`, `#about`, `#account`, `#booth`). The guided booth flow keeps its current step and photo-card state in `Booth.tsx`; focused screens render layout, source, camera/upload, editing, and export.
- **Photo processing:** Browser camera/media APIs, WebRTC, Canvas rendering, and a Web Worker for filter work. Photos are captured/processed in the browser. The room signaling service carries room state and connection metadata; duo still photos are transferred between participants over a WebRTC data channel. Photos and video are not sent through the room API or saved to a server by the photo workflow.
- **Backend and database:** Supabase Auth and PostgreSQL. SQL migrations define accounts, credit ledger/top-ups, session reservations and charges, hosted rooms, login protections, and RPCs. Supabase Realtime Broadcast is used for authorized camera signaling. A browser-safe publishable key is used client-side; privileged credentials stay server-side.
- **Server APIs / hosting:** Vercel hosts the Vite-built site and API routes for hosted rooms, account/password support, and payment email flows. Vite also has a local room-service mode for development. Cloudflare TURN provides relay credentials for WebRTC when direct connections fail.
- **Device recovery:** IndexedDB stores an encrypted-context-free, device-local photo-card draft keyed by the signed-in user, with a 24-hour expiry. The saved draft includes the card, source, mode, session ID, and editing stage. This is a local recovery copy, not cloud photo storage.
- **Tests:** Node’s test runner covers the client logic and server flows; browser tests use Playwright for capture/editor/navigation behavior. Build runs TypeScript checking and Vite production compilation.

## Key design decisions

1. **Keep photos on participants’ devices.** This avoids routing private photos through the signaling backend and lets each person control their own copy. A local recovery draft helps protect editing work without introducing server-side photo storage.
2. **Separate signaling from media.** Room membership, readiness, and WebRTC setup use authenticated API/Realtime signaling. Camera video and shared stills use WebRTC between browsers. TURN is available for restrictive networks; preview latency and quality still depend on device and network conditions.
3. **Charge only when users confirm editing.** Capturing and reviewing photos do not deduct points. The explicit confirmation before editing calls the server-side session completion flow, which uses the free trial first or charges 100 points. Session IDs and idempotent database functions support safe retries and paid-session recovery.
4. **Use a guided, step-based flow.** Solo/duo, photo source, layout, photos, frame/filter, and export are presented as a sequence. Browser history tracks step navigation, while dialogs protect against leaving with unsaved work.
5. **Use supplied artwork as artwork.** Templates preserve their printed design text; user-selected filters apply to photos. Classic and template-based cards use the same Canvas renderer for preview and export, with print sizing handled explicitly.
6. **Favor usable mobile controls.** Camera settings are collapsible, photo thumbnails show the full captured image, frame/filter previews scroll with the page on mobile, and filter selection is a compact dropdown in editing. Export omits editing controls and focuses on the finished card and saving it.
7. **Retain tested JavaScript photo logic alongside TypeScript UI.** Core capture, crop, rendering, recovery, and transport behavior lives in small modules to keep algorithmic changes independently testable while React screens are typed.

## Built today

- Landing page, About page, sign-in/account surfaces, and the hash-routed booth.
- Solo camera capture and photo upload; configurable layouts, countdown/manual capture, mirror/sound/flash options, individual retakes, and photo reordering.
- Duo room creation/join by invitation or code, participant readiness/presence, live camera previews, WebRTC signaling/relay support, shared still-photo transfer, reconnect handling, and host-controlled capture/order.
- Photo review, crop positioning, artwork/frame selection, caption or artwork-specific text, photo filters, and card preview.
- PNG/JPG downloads, print flow, mobile share/open-image fallback, and export retry support.
- Account sign-in and wallet/points flows, top-ups, session billing, receipts/payment email support, and administrator/payment configuration paths.
- Automatic device-local recovery for completed, approved editing sessions, with a visible saved-draft resume/delete option when such a draft is available.
- Automated tests for layout, capture, transport, server room limits/authorization, billing, recovery, filters, and export geometry, plus selected real-browser checks.

## Remaining work and known gaps

### Priority: Your Photos session recovery

Recovery is **not yet complete for an active, unconfirmed photo session**. The current IndexedDB draft is written only after all required photos are present (and the paid editing approval has occurred for a creator). On page departure, the in-memory booth resets; on opening `#booth`, the step initialization starts at the beginning. As a result, a user who refreshes during capture can lose access to the active UI state while the server still holds a session reservation. The “active booth already exists” dialog does not currently offer a direct way to reopen that pre-edit session. This matches the reported screenshot and should be treated as the next recovery/navigation task.

The requested end state is to persist and restore the correct session type, reservation/session identifier, step, and local photos where possible; show a clear “Resume existing session” route when automatic restore cannot safely happen; and offer a deliberate new-session path that does not overwrite or strand existing work. Duo recovery needs special handling because its room and camera connection also have server-side expiry and participant state. Recovery data must remain user-scoped, validated, expiry-aware, and safe around billing retries.

### Other follow-up

- Run a full end-to-end test of recovery on real mobile browsers, including refresh, tab close, force-quit/reopen, stale/expired reservations, and starting a new session while a draft exists.
- Verify deployed Supabase migration level and Vercel environment/API configuration when diagnosing hosted-session conflicts; local source alone cannot establish the live database state.
- Continue device/network compatibility checks for duo camera reliability. The product decision is to prioritize successful camera connection and photo delivery over pursuing a specific preview frame rate.
- The current template catalog is intentionally partial: supplied template designs are available for Layout A; other layouts use Classic until additional artwork is completed and integrated. Confirm desired template coverage before expanding it.
- Reconcile `website/README.md`’s older statements that recovery, duo sessions, and backend features are unimplemented; current code and setup documents show those features have since been added.

## Main project locations

- `website/src/booth/Booth.tsx` — booth state, steps, billing boundary, recovery, and navigation.
- `website/src/booth/SessionScreen.tsx`, `useDuoPeer.ts`, `useRoom.ts` — camera capture, duo peer connection, and room lifecycle.
- `website/src/booth/recoveryStore.js` — IndexedDB draft persistence and validation.
- `website/src/booth/EditScreen.tsx`, `renderCard.js`, `designs.ts` — editing and card rendering.
- `website/server/`, `website/api/` — server APIs and hosted room/payment support.
- `website/*.sql` — ordered Supabase schema and function migrations (001–018 at review time).
- `website/tests/` — automated logic and browser tests.
- `website/VERCEL_SETUP.md`, `website/TURN-SETUP.md`, `website/ROOMS.md` — deployment and service setup notes.
- `work/prototype-before-react/` — retained pre-React prototype backup.

## Local commands

From `website/`, use `pnpm dev` to run the local app, `pnpm test` for Node tests, and `pnpm build` for type checking and a production build. The parent folder also provides `start-preview.ps1`.
