import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export function makeLoginHandler({env=process.env,fetcher=fetch,clientFactory=createClient}={}) { return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Method not allowed'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
 const {email,password,captchaToken}=req.body||{};
 if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length>128||typeof captchaToken!=='string')return res.status(400).json({message:'Invalid sign-in details.'});
 if(!url||!env.SUPABASE_SERVICE_ROLE_KEY||!env.VITE_SUPABASE_PUBLISHABLE_KEY)return res.status(503).json({message:'Sign-in is temporarily unavailable.'});
 // Vercel overwrites this header. Do not trust a client-provided generic X-Forwarded-For.
 const ip=env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
 if(!ip)return res.status(503).json({message:'Could not verify connection.'});
 const hash=v=>createHash('sha256').update(v).digest('hex');
 const keys=['email:'+hash(email.trim().toLowerCase()),'ip:'+hash(String(ip))];
 const db=clientFactory(url,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const limit=async operation=>{const {data,error}=await db.rpc('together_login_limit',{keys,operation});if(error)throw error;return data;};
 const limited=seconds=>{res.setHeader('Retry-After',String(seconds));return res.status(429).json({message:'Too many sign-in attempts. Please wait.',retryAfter:seconds});};
 let acquired=false;
 try{
  // Bounded housekeeping, separate from login locks; a cleanup failure must not
  // block sign-in (also permits rolling deployment before migration 018).
  try { await db.rpc('together_prune_login_limits'); } catch { /* Retry cleanup on a later request. */ }
  const wait=await limit('begin');if(wait)return limited(wait);acquired=true;
  const response=await fetcher(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password,gotrue_meta_security:{captcha_token:captchaToken}}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  const seconds=await limit(response.ok?'success':result.error_code==='invalid_credentials'?'failure':'release');acquired=false;
  if(seconds)return limited(seconds);
  if(!response.ok&&result.error_code==='invalid_credentials'){
   const {data:attemptsRemaining,error}=await db.rpc('together_login_attempts_remaining',{keys});
   if(error)throw error;
   return res.status(400).json({code:'invalid_credentials',attemptsRemaining,message:`Incorrect email or password. ${attemptsRemaining} attempt${attemptsRemaining===1?'':'s'} remaining.`});
  }
  if(!response.ok){const hookLock=String(result.msg||result.message||result.error_description||'').match(/together_login_locked:(\d+)/);if(hookLock)return limited(Math.max(1,Math.min(300,Number(hookLock[1])-Math.floor(Date.now()/1000))));if(response.status===429)return limited(60);return res.status(response.status>=500?503:400).json({code:result.error_code,message:result.error_code==='email_not_confirmed'?'Please confirm your email before signing in.':'Sign-in failed. Check your details and try again.'});}
  return res.status(200).json({access_token:result.access_token,refresh_token:result.refresh_token});
 }catch{return res.status(503).json({message:'Sign-in is temporarily unavailable. Please try again.'});}
 finally{if(acquired)await limit('release').catch(()=>{});}
};}
export default makeLoginHandler();
