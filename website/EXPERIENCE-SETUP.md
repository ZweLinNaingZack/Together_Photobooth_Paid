# Session recovery, camera quality and export improvements

## Deploy

1. Run `016-resume-session.sql` in this project's Supabase SQL Editor after the existing migrations. It adds a read-only authenticated lookup; it cannot debit a wallet and only returns the caller's completed session.
2. Push these changes and wait for the Vercel production deployment to finish. No new environment variables or paid services are required.
3. Test the production domain on two real devices, including iPhone Safari and an Android browser, across Wi-Fi/mobile data. Local automated tests do not establish real-world connection times or TURN availability.

## What changed

- Account, About and Booth load as separate JavaScript bundles. The booth mounts only when first needed.
- Duo's Ready button prepares the camera in the waiting room. The photo session reuses that camera instead of opening it again. Camera permissions still require the user's consent.
- Video senders aim for a 640-pixel-wide, 24fps, 700kbps preview, subject to browser support. Local capture requests up to 1920×1440, subject to camera capability; snapshots never upscale their source and have a 1920px maximum edge.
- Each Duo device captures its own JPEG still. The creator receives the partner's original, combines the pair, and shares the same result back. Photos travel through the encrypted peer connection, not the app database. A slow connection can still take longer to transfer originals than a preview screenshot.
- The camera viewport uses the first layout slot's aspect ratio. Other frame shapes can crop differently; the editor retains position controls. A camera selector is shown where multiple cameras are available.
- Closed photo channels recover automatically with bounded retries. An online event retries a disconnected camera. Connection time and selected route remain available in Connection details.
- Filters use a worker when supported, with a deterministic fallback. Previews are smaller, stale queued previews are skipped, and rendering decodes one photo at a time to reduce peak memory.
- A prepared export remains available for repeat download, open-image and native file sharing where supported. Choosing another frame/filter invalidates that prepared export. Leaving the editor releases its object URL.

## Optional recovery and privacy

Recovery is off by default. Enabling it saves the photos, editor settings and session ID to IndexedDB on that browser/device, keyed to the signed-in account. A complete copy is saved before charging when recovery is enabled. If that write fails, the user can free storage or disable recovery; the failed write does not initiate a debit.

On return, the server verifies the creator's completed payment/free-trial use before opening saved editing. Restoring never initiates a charge. Guests save only after the creator has opened shared editing. Restored sessions support editing/export rather than reconnecting to an old camera room or taking new photos.

Copies expire after 24 hours from the last save and are removed when the booth next reads them. Explicitly leaving the booth or disabling recovery removes the copy. Browsers may evict local storage sooner; private mode and storage restrictions can prevent saving. This is device-local recovery, not a cloud photo library or a guarantee after device loss.

Support measurements are held in memory with a maximum of 40 events. Only allowlisted event names, durations, timestamps and random references are collected. Users can copy them for support. They contain no photos, account identifiers, invitation codes, SDP or network addresses. This change does not install remote analytics or an automatic alerting service.

## Release checks

- Enable recovery, complete a paid/free-trial session, refresh, and resume editing. Confirm the balance changes only once. Repeat as a Duo guest: no debit to the guest.
- Disable recovery or explicitly leave, then reopen the booth: the saved copy should be gone.
- Test low storage: a failed recovery save must not debit before the confirmation can complete.
- In Duo, allow camera access at Ready, enter on both devices, take manual and timed photos, and confirm both receive the same card. Disconnect/reconnect a network and check earlier photos remain.
- Compare exported photos with the preview on weak and strong cameras. More capture pixels cannot recover missing focus or poor lighting.
- Export twice, change filter and export again, then test native Share/Save on physical phones. Retry a cancelled share without a second charge.
- Test camera switching, mouse/touch crop adjustments, long Music Player titles/subtitles, and narrow screens.

## Automated checks

`node --test tests/*.test.mjs`, TypeScript checking, and the Vite production build cover the existing flows. With the local preview running, `tests/experience-browser.mjs` checks worker parity, local recovery and repeat downloads. `tests/duo-capture-browser.mjs` uses real local WebRTC with generated camera images and isolated signaling to verify original-photo exchange and reconnect recovery. Both accept a Playwright module path as their first argument.
