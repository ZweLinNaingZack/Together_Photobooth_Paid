import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { paymentEmail } from '../server/payment-email.mjs';

export function makeHandler({env=process.env,fetcher=fetch,clientFactory=createClient}={}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  const secret=env.EMAIL_WORKER_SECRET, supplied=String(req.headers.authorization||'');
  const expected=Buffer.from(`Bearer ${secret||''}`), actual=Buffer.from(supplied);
  if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).json({error:'Unauthorized'});
  const required=['SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','EMAIL_FROM','ADMIN_EMAIL','SUPPORT_EMAIL','SITE_URL'];
  if(required.some(k=>!env[k])||!(env.SUPABASE_URL||env.VITE_SUPABASE_URL))return res.status(503).json({error:'Email service is not configured'});
  try {
   const db=clientFactory(env.SUPABASE_URL||env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   let processed=0, accepted=0;
   const deadline=Date.now()+20000;
   while(processed<5 && Date.now()<deadline-1500){
   const {data,error}=await db.rpc('together_claim_email');if(error)throw error;
   const job=data?.[0];if(!job)break;
   let sentId=null,failure=null,permanent=false;
   try {
    // Persist the exact request before the first attempt: retries must use identical content.
    let body=job.email_body;
    if(!body){
     const template=paymentEmail(job,{siteUrl:env.SITE_URL,supportEmail:env.SUPPORT_EMAIL,logoUrl:env.EMAIL_LOGO_URL||`${new URL(env.SITE_URL).origin}/email-logo.png`});
     body={from:env.EMAIL_FROM,to:[job.event==='pending'?env.ADMIN_EMAIL:job.payload.email],reply_to:env.SUPPORT_EMAIL,...template};
     const saved=await db.rpc('together_prepare_email',{job_id:job.id,lease_id:job.lease,body});
     if(saved.error||!saved.data)throw new Error('Could not prepare email');body=saved.data;
    }
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`payment/${job.id}`},body:JSON.stringify(body),signal:AbortSignal.timeout(Math.max(1,Math.min(12000,deadline-Date.now())))});
    if(response.ok){const result=await response.json();if(!result.id)throw new Error('Missing provider ID');sentId=result.id;}
    else {failure=`Provider HTTP ${response.status}`;permanent=response.status>=400&&response.status<500&&![408,409,429].includes(response.status);}
   }catch{failure='Email attempt failed; retry scheduled';}
   const done=await db.rpc('together_finish_email',{job_id:job.id,lease_id:job.lease,sent_id:sentId,failure,permanent});if(done.error)throw done.error;
   processed++; if(sentId)accepted++;
   await new Promise(resolve=>setTimeout(resolve,600));
   }
   return res.status(200).json({processed,accepted});
  }catch{return res.status(503).json({error:'Email worker temporarily unavailable'});}
 };
}
export default makeHandler();
