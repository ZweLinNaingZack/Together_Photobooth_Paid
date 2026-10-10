import { createClient } from '@supabase/supabase-js';
import { createHostedRoomService, supabaseRoomStore } from '../../server/hosted-rooms.mjs';
import { createVerifiedUserCache } from '../../server/auth-cache.mjs';
// Kept between requests on the same server instance: one Supabase client and a short-lived
// cache of verified logins, so check-ins don't ask Supabase Auth every 1.5–4 seconds.
const verifiedUsers = createVerifiedUserCache();
let shared = null;
function supabaseClient(url, key) {
  if (!shared || shared.url !== url || shared.key !== key) shared = { url, key, client: createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}) };
  return shared.client;
}
const actions = new Set(['create','join','ready','state','leave','signal','signals','rtc','mine']);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  const send = (status,data) => {res.statusCode=status;res.end(JSON.stringify(data));};
  try {
    if(req.method !== 'POST') return send(405,{error:'Method not allowed.'});
    if(req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403,{error:'Request origin is not allowed.'});
    const action = req.query?.action;
    if(!actions.has(action)) return send(404,{error:'Unknown booth action.'});
    const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url || !key) return send(503,{error:'The hosted booth service is not configured.'});
    const jwt = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if(!jwt) return send(401,{error:'Please sign in first.'});
    const client = supabaseClient(url,key);
    const auth = await verifiedUsers.verify(jwt, async token => {
      const {data,error} = await client.auth.getUser(token);
      if(error && (!error.status || error.status >= 500)) return {ok:false,unavailable:true};
      if(error || !data.user?.email_confirmed_at) return {ok:false};
      return {ok:true,userId:data.user.id};
    });
    if(auth.unavailable) return send(503,{error:'Account verification is temporarily unavailable. Please retry the connection.'});
    if(!auth.ok) return send(401,{error:'Please sign in with a verified account.'});
    let body=req.body;
    if(typeof body === 'string') { try {body=JSON.parse(body);} catch {return send(400,{error:'Invalid request.'});} }
    if(!body || typeof body!=='object' || Array.isArray(body)) return send(400,{error:'Invalid request.'});
    if(Buffer.byteLength(JSON.stringify(body)) > (action === 'signal' ? 26000 : 4096)) return send(413,{error:'Request too large.'});
    const service=createHostedRoomService({store:supabaseRoomStore(client)});
    return send(200,await service.run(action,body,auth.userId));
  } catch(error) {return send(error.status || 503,{error:error.status ? error.message : 'The booth service is unavailable. Please try again.'});}
}
