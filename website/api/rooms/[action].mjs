import { createClient } from '@supabase/supabase-js';
import { createHostedRoomService, supabaseRoomStore } from '../../server/hosted-rooms.mjs';
const actions = new Set(['create','join','ready','state','leave','signal','signals','rtc']);
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
    const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error} = await client.auth.getUser(jwt);
    if(error || !data.user?.email_confirmed_at) return send(401,{error:'Please sign in with a verified account.'});
    let body=req.body;
    if(typeof body === 'string') { try {body=JSON.parse(body);} catch {return send(400,{error:'Invalid request.'});} }
    if(!body || typeof body!=='object' || Array.isArray(body)) return send(400,{error:'Invalid request.'});
    if(Buffer.byteLength(JSON.stringify(body)) > (action === 'signal' ? 26000 : 4096)) return send(413,{error:'Request too large.'});
    const service=createHostedRoomService({store:supabaseRoomStore(client)});
    return send(200,await service.run(action,body,data.user.id));
  } catch(error) {return send(error.status || 503,{error:error.status ? error.message : 'The booth service is unavailable. Please try again.'});}
}
