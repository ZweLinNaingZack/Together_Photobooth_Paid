# Duo room milestone

Creator: Duo → Create a booth → Layout → Photo source → Frame → Create invitation → Waiting room.

Guest: Duo → Join a booth → Enter code → Waiting room. Invitation links open the join screen with the invitation already supplied, without choosing a layout again.

Both participants choose Ready independently. The server computes whether both are ready, and the client rechecks it before opening the photo/upload step. Losing connection returns an active photo step to the waiting room. Leaving as the creator ends the room; leaving as the guest frees the second seat and resets readiness.

## What is connected

The API in `server/rooms.mjs` runs in the Vite development/preview process through `vite.config.mjs`. It shares room settings and presence across clients, using separate random participant tokens and a long random invitation token. Six-character codes are an alternative to links. Rooms allow two members, expire after 45 minutes, and expire early if the host has not contacted the server for 60 seconds. Presence goes offline after 15 seconds and readiness resets. Requests are size-limited; create/join attempts are rate-limited.

Rooms exist only in server memory. Restarting the preview invalidates invitations. No photos, video or audio are sent to the room service. Keep the host tab open while testing.

## Try it locally

Start the usual preview. In one tab create a Duo booth and finish frame selection. Copy the code. In another tab choose Duo → Join a booth and enter it. Both tabs should see the two people and readiness updates. Copying the invitation link opens the same join flow directly.

The current `127.0.0.1` link is for this computer only. A friend on another network needs an HTTPS deployment with the room API available. The existing Sites manifest still describes a static build: deploying `dist` alone will not host this API. Select and configure backend hosting before internet testing; this milestone makes no external deployment or access changes.

## Live Duo cameras

Both participants enter the camera page and grant permission. `useDuoPeer.ts` exchanges authenticated WebRTC offers, answers and ICE candidates through the room API. Each browser sends a video track (no microphone audio). Both previews use host-left / guest-right placement and each person's mirror preference.

The host controls the countdown and captures a composite of its local video and the received remote video. Remote video has normal network latency; this is not exact simultaneous full-resolution sampling on both devices. The reliable WebRTC data channel transfers the resulting JPEG in bounded chunks and waits for acknowledgment before the next capture. Both users receive the same photo; retakes replace one slot. The host shares reorder actions and sends both users to export. Each may choose a different filter and download. Cameras pause transmission during export; the peer connection remains for retakes, and leaving releases tracks and closes it.

The solo camera page also opens the real webcam automatically. Permission failures show an explanation and a retry button. No stock-photo capture fallback remains.

Connection discovery currently uses Cloudflare's public STUN service. A TURN relay is **not configured**: restrictive school/work/mobile networks may block direct connections even though invitations work over HTTPS. A production deployment needs authenticated, short-lived TURN credentials. Cloudflare Quick Tunnel only forwards HTTP signaling; it is not a media relay. The UI reports connection trouble and offers reconnection. Upload mode remains independent per participant.

For testing, use the same temporary HTTPS tunnel on both devices, create a fresh room after server changes, mark both ready, and enter the camera page on both. Allow camera access, check the two live views and mirror choices, capture a photo, verify both trays match, retake one slot, then export. Real cross-device camera validation must be performed on those devices; automated room tests cannot establish device permission or network compatibility.

Run `node --test tests/rooms.test.mjs` for room isolation, invite/code joining, authentication, readiness, capacity, expiry, rate limiting and two-client HTTP checks. These do not replace visual browser testing.
