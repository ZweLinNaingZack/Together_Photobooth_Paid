import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentEmail} from '../server/payment-email.mjs';
import {makeHandler} from '../api/payment-emails.mjs';
const job={id:'job-1',lease:'lease-1',event:'approved',payload:{orderId:'order-1',name:'<script>bad</script>',email:'a@example.test',userId:'user-1',amount:21000,points:300,balance:500,date:'2026-10-04T12:00:00Z',reason:'<img src=x>'}};
const config={siteUrl:'https://example.test',supportEmail:'support@example.test',logoUrl:'https://example.test/email-logo.png'};
test('branded templates escape user content and link to authenticated review',()=>{
 for(const event of ['pending','approved','rejected']){
  const email=paymentEmail({...job,event},config);
  assert.match(email.html,/max-width:600px/);assert.match(email.html,/email-logo.png/);
  assert.ok(!email.html.includes('<script>'));assert.ok(!email.html.includes('<img src=x>'));
  assert.match(email.text,/21,000/);
  if(event==='approved')assert.match(email.text,/500 points/);
  if(event==='pending'){assert.match(email.html,/action=approve#account\/admin/);assert.match(email.html,/action=reject#account\/admin/);}
 }
});
const env={EMAIL_WORKER_SECRET:'secret',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'server-secret',RESEND_API_KEY:'resend-secret',EMAIL_FROM:'Together <hello@example.test>',ADMIN_EMAIL:'admin@example.test',SUPPORT_EMAIL:'support@example.test',SITE_URL:'https://example.test'};
function response(){return {code:0,body:null,setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
test('worker rejects unauthenticated calls before accessing the database',async()=>{
 const res=response();await makeHandler({env,clientFactory:()=>{throw Error('must not run');}})({method:'POST',headers:{}},res);assert.equal(res.code,401);
});
test('worker sends with stable idempotency and records acceptance',async()=>{
 let claimed=false,finished,request;
 const db={rpc:async(name,args)=>{
  if(name==='together_claim_email'){const data=claimed?[]:[job];claimed=true;return {data};}
  if(name==='together_prepare_email')return {data:args.body};
  finished=args;return {};
 }};
 const res=response();await makeHandler({env,clientFactory:()=>db,fetcher:async(_,req)=>{request=req;return {ok:true,json:async()=>({id:'email-1'})};}})({method:'POST',headers:{authorization:'Bearer secret'}},res);
 assert.equal(res.code,200);assert.equal(finished.sent_id,'email-1');assert.equal(request.headers['Idempotency-Key'],'payment/job-1');
 assert.deepEqual(JSON.parse(request.body).to,['a@example.test']);
});
test('provider failures queue retry without changing payment state',async()=>{
 let claimed=false,finished;
 const db={rpc:async(name,args)=>{if(name==='together_claim_email'){const data=claimed?[]:[job];claimed=true;return {data};}if(name==='together_prepare_email')return {data:args.body};finished=args;return {};}};
 await makeHandler({env,clientFactory:()=>db,fetcher:async()=>({ok:false,status:429})})({method:'POST',headers:{authorization:'Bearer secret'}},response());
 assert.equal(finished.sent_id,null);assert.equal(finished.permanent,false);assert.equal(finished.failure,'Provider HTTP 429');
});
