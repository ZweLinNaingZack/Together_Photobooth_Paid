import { createRoomService } from './rooms.mjs';
import { createTurnProvider } from './turn.mjs';
const fail = (message, status) => Object.assign(new Error(message), { status });
export function createHostedRoomService({ store, rtcConfig = createTurnProvider() }) {
  return { async run(action, body, userId) {
    if (!userId) throw fail('Please sign in first.', 401);
    // Two devices may use the same account; allow both heartbeat/signaling loops.
    if (!await store.limit(`${userId}:all`, 600)) throw fail('Too many requests. Please wait a minute.', 429);
    if (['create','join','rtc'].includes(action) && !await store.limit(`${userId}:${action}`,20)) throw fail('Too many attempts. Please wait a minute.',429);
    for (let attempt = 0; attempt < 8; attempt++) {
      const row = action === 'create' ? null : await store.load(body);
      const room = row?.data;
      if (action !== 'create' && !room) throw fail('That booth has ended or expired.',404);
      if (room && action !== 'join') {
        const member = room.host.token === body.token ? room.host : room.guest?.token === body.token ? room.guest : null;
        if (!member || member.userId !== userId) throw fail('You are not connected to this booth.',403);
      }
      if (action === 'rtc' && store.authorize && !await store.authorize(room.invite,room.host.userId)) throw fail('The creator needs to authorize this booth before the cameras connect.',409);
      const rooms = new Map(room ? [[room.code,room]] : []);
      const service = createRoomService({ rooms, rtcConfig });
      const result = await service.run(action, body, userId);
      // The separate state heartbeat owns presence. Reading camera messages must
      // not contend with offer/answer writes or invalidate their room version.
      if (action === 'signals') return result;
      // Credentials are short-lived and cached by this browser's camera session.
      // Do not hold up the handshake trying to persist them against heartbeats.
      if (action === 'rtc') return { ...result, signalTopic: room.signalTopic || null };
      const code = room?.code || result.code;
      const updated = rooms.get(code);
      if (updated) {
        if (action === 'create') updated.host.userId = userId;
        if (action === 'join') updated.guest.userId = userId;
        // The local service caches a Promise; persist only its resolved JSON value.
        for (const member of [updated.host, updated.guest]) if (member?.rtc) member.rtc = await member.rtc;
      }
      if (await store.save(code,row?.version || 0,updated || null)) return result;
    }
    throw fail('The booth is busy updating. Please try again.',409);
  } };
}

export function supabaseRoomStore(client) {
  return {
    async authorize(invitation,creator) {
      const {data,error} = await client.rpc('together_room_has_ticket',{invitation,creator});
      if(error) throw error; return data;
    },
    async limit(bucket,maximum) {
      const { data,error } = await client.rpc('together_room_limit',{bucket,maximum});
      if (error) throw error; return data;
    },
    async load(body) {
      const query = client.from('together_rooms').select('data,version');
      const {data,error} = await (typeof body.invite === 'string' ? query.eq('invite',body.invite) : query.eq('code',String(body.code || '').trim().toUpperCase())).maybeSingle();
      if(error) throw error; return data;
    },
    async save(code,version,data) {
      const result = await client.rpc('together_save_room',{room_code:code,expected_version:version,room_data:data});
      if(result.error) throw result.error; return result.data;
    }
  };
}
