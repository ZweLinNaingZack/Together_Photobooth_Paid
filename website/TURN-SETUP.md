# Connecting cameras across networks

The HTTPS tunnel shares the website and room messages. It does not forward WebRTC video. When a mobile carrier or router blocks a direct connection, the browsers need a TURN relay.

## Activate Cloudflare Realtime TURN

1. Sign in to your Cloudflare account and create a Realtime TURN key using the [official setup guide](https://developers.cloudflare.com/realtime/turn/generate-credentials/). Check the service's current pricing in your account before enabling it.
2. Copy `.env.example` to `.env` in this `website` folder.
3. Enter the key ID as `TURN_KEY_ID`, and the key's API token as `TURN_KEY_API_TOKEN`. Enter them locally, not in chat. `.env` is ignored by Git. Do not use a `VITE_` prefix or put the master key in React code.
4. Restart the website preview. Keep your tunnel running; if its address changes, update the allowed hostname.
5. Refresh both devices, create a new booth and enter the camera session on both devices. Test Wi-Fi versus mobile data, take a shared photo, and confirm the same image arrives on both devices.

The authenticated `/api/rooms/rtc` endpoint generates one temporary credential per ready participant, reuses it on reconnect, and never sends the master key to the browser. Credentials last an hour; rooms last at most 45 minutes. Missing settings explicitly report no relay; invalid settings produce an error instead of pretending that a relay is active.

When a camera connection is stuck, expand **Connection details** under the camera. It reports negotiation and network states, candidate counts, decoded video frames, and whether a relay is configured. It omits keys, room codes, IP addresses, and photos. A configured relay does not by itself prove a successful video connection; the two-device test is still required.

Connection messages retry transient failures with stable IDs. The room API deduplicates retried messages; repeating a handshake resends its offer or answer instead of leaving the other browser waiting forever.

The local service is intended for development. Before public production launch, configure permanent backend hosting, service quotas, abuse controls, and monitoring. A static deployment alone does not provide the room or TURN credential API.
