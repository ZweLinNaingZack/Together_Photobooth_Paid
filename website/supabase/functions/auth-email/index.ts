import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { authEmail } from './template.ts';
Deno.serve(async req => {
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('SEND_EMAIL_HOOK_SECRET'),apiKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('EMAIL_FROM'),site=Deno.env.get('SITE_URL'),support=Deno.env.get('SUPPORT_EMAIL');
 if(!secret||!apiKey||!from||!site||!support)return Response.json({error:{http_code:503,message:'Email delivery is not configured'}},{status:503});
 let payload;
 try { payload=new Webhook(secret.replace(/^v1,whsec_/, '')).verify(await req.text(),Object.fromEntries(req.headers)) as {user:{email:string,new_email?:string},email_data:{email_action_type:string,token_hash:string,token_hash_new?:string,token:string,redirect_to:string}}; }
 catch {return new Response('Invalid signature',{status:401});}
 try {
  const {user,email_data:d}=payload,action=d.email_action_type;
  if(!['signup','recovery','invite','magiclink','email_change','reauthentication'].includes(action))throw new Error('Unsupported auth email');
  const recipients=action==='email_change'?[{email:user.new_email,hash:d.token_hash},...(d.token_hash_new?[{email:user.email,hash:d.token_hash_new}]:[])]:[{email:user.email,hash:d.token_hash}];
  const signal=AbortSignal.timeout(4000);
  for(let i=0;i<recipients.length;i++){
   const item=recipients[i];if(!item.email)throw new Error('Missing recipient');
   const link=new URL('/auth/v1/verify',Deno.env.get('SUPABASE_URL'));
   link.searchParams.set('token',item.hash);link.searchParams.set('type',action);link.searchParams.set('redirect_to',d.redirect_to||site);
   const template=authEmail(action,link.href,Deno.env.get('EMAIL_LOGO_URL')||`${new URL(site).origin}/email-logo.png`,support,d.token);
   // Await provider acceptance; no sleeps, SMTP handshake or untracked background work.
   const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`auth/${req.headers.get('webhook-id')}/${i}`},body:JSON.stringify({from,to:[item.email],reply_to:support,...template}),signal});
   if(!result.ok)throw new Error('Provider refused email');
  }
  return Response.json({});
 }catch{return Response.json({error:{http_code:503,message:'Email delivery is temporarily unavailable. Please request a new email shortly.'}},{status:503});}
});
