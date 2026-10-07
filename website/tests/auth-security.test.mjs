import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {strongPassword} from '../src/auth/passwordPolicy.js';
import {makeLoginHandler} from '../api/password-login.mjs';
import {readLoginLock,saveLoginLock} from '../src/auth/loginCountdown.js';
test('countdown survives a new browser view and uses elapsed wall time',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 saveLoginLock(storage,301000);assert.equal(readLoginLock(storage,121000),301000);
 assert.equal(readLoginLock(storage,302000),0);saveLoginLock(storage,0);assert.equal(readLoginLock(storage,1000),0);
 assert.equal(readLoginLock({getItem(){throw Error('blocked');}}),0);
});
import {makeAccountHandler} from '../api/password-account.mjs';
import {readEmailCallback,cleanEmailCallback} from '../src/auth/emailCallback.js';
test('signup and reset reject weak passwords before contacting Supabase',async()=>{
 const handler=makeAccountHandler({fetcher:()=>{throw Error('Must not contact provider');}});
 for(const operation of ['signup','update'])for(const password of ['abcdefgh','ABCDEFGH1!','abcdefgh1!','Abcdefgh!','Abcdefgh1']){
  const res={setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
  await handler({method:'POST',headers:{},body:{operation,password}},res);
  assert.equal(res.statusCode,422);assert.equal(res.body.code,'weak_password');
 }
});
test('email callbacks accept only email/recovery and remove secrets without dropping routing',()=>{
 for(const type of ['email','recovery']){
  const url=`https://example.test/?auth_token_hash=secret&auth_type=${type}#account`;
  assert.deepEqual(readEmailCallback(url),{token_hash:'secret',type});
  assert.equal(cleanEmailCallback(url),'https://example.test/#account');
 }
 assert.equal(readEmailCallback('https://example.test/?auth_token_hash=secret&auth_type=admin'),null);
});
test('strong signup preserves CAPTCHA and update requires a session',async()=>{
 let body;
 const handler=makeAccountHandler({env:{SUPABASE_URL:'https://project.test',VITE_SUPABASE_PUBLISHABLE_KEY:'public',SITE_URL:'https://site.test'},fetcher:async(url,options)=>{body=JSON.parse(options.body);assert.equal(url.searchParams.get('redirect_to'),'https://site.test/#account');return {ok:true,json:async()=>({id:'private'})};}});
 const res={setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
 await handler({method:'POST',headers:{},body:{operation:'signup',email:'alice@gmail.com',password:'Abcdefg1!',captchaToken:'captcha'}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(body.gotrue_meta_security,{captcha_token:'captcha'});assert.deepEqual(res.body,{ok:true});
 await handler({method:'POST',headers:{},body:{operation:'update',password:'Abcdefg1!'}},res);assert.equal(res.statusCode,401);
});
import ts from 'typescript';
test('auth templates render branded verification and recovery with escaped links',async()=>{
 const source=await readFile(new URL('../supabase/functions/auth-email/template.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 const {authEmail}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 for(const action of ['signup','recovery']){
  const mail=authEmail(action,'https://example.test/?token=secret&next=account','https://example.test/email-logo.png','help@example.test');
  assert.match(mail.html,/max-width:600px/);assert.match(mail.html,/token=secret&amp;next/);assert.match(mail.html,/single-use/);assert.match(mail.html,action==='signup'?/Verify my email/:/Reset password/);
 }
});
test('login gateway returns 429 without password verification when locked',async()=>{
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 const handler=makeLoginHandler({env:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'server',VITE_SUPABASE_PUBLISHABLE_KEY:'public',VERCEL:'1'},clientFactory:()=>({rpc:async()=>({data:300})}),fetcher:()=>{throw Error('Must not call Auth');}});
 await handler({method:'POST',headers:{'x-vercel-forwarded-for':'192.0.2.1'},body:{email:'test@gmail.com',password:'wrong',captchaToken:'test'}},response);
 assert.equal(response.statusCode,429);assert.equal(response.body.retryAfter,300);assert.equal(response.headers['Retry-After'],'300');
});
test('gateway clears failures on successful login and only returns session tokens',async()=>{
 const calls=[];const response={setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 const handler=makeLoginHandler({env:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'server',VITE_SUPABASE_PUBLISHABLE_KEY:'public'},clientFactory:()=>({rpc:async(name,args)=>{calls.push(args.operation);return {data:0};}}),fetcher:async()=>({ok:true,json:async()=>({access_token:'access',refresh_token:'refresh',user:{email:'private'}})})});
 await handler({method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'},body:{email:'test@gmail.com',password:'valid',captchaToken:'test'}},response);
 assert.deepEqual(calls,['begin','success']);assert.deepEqual(response.body,{access_token:'access',refresh_token:'refresh'});
});

test('login accepts Supabase thenable RPC builders and tolerates failed housekeeping',async()=>{
 for(const cleanupFails of [false,true]){
  const calls=[];
  const handler=makeLoginHandler({env:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'server',VITE_SUPABASE_PUBLISHABLE_KEY:'public'},
   clientFactory:()=>({rpc(name){
    calls.push(name);
    return {then(resolve,reject){return (name==='together_prune_login_limits'&&cleanupFails?Promise.reject(Error('temporary')):Promise.resolve({data:0})).then(resolve,reject);}};
   }}),
   fetcher:async()=>({ok:true,json:async()=>({access_token:'access',refresh_token:'refresh'})})});
  const res={setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
  await handler({method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'},body:{email:'alice@gmail.com',password:'valid',captchaToken:'test'}},res);
  assert.equal(res.statusCode,200);assert.deepEqual(calls,['together_prune_login_limits','together_login_limit','together_login_limit']);
 }
});
test('password policy requires all five classes',()=>{
 for(const value of ['Ab1!','abcdefgh1!','ABCDEFGH1!','Abcdefgh!','Abcdefgh1','Abcdefg1_'])assert.equal(strongPassword(value),false,value);
 for(const symbol of '!@#$%^&*(),.?":{}|<>')assert.equal(strongPassword(`Abcdefg1${symbol}`),true);
});
test('shared limiter locks fifth failure, resets on success and expires',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;');
 await db.exec(await readFile(new URL('../013-login-security.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../015-login-attempts.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../004-hosted-rooms.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../018-resource-limits.sql',import.meta.url),'utf8'));
 const call=async op=>(await db.query('select together_login_limit($1,$2) as seconds',[['email:alice','ip:one'],op])).rows[0].seconds;
 for(let i=1;i<=5;i++){assert.equal(await call('begin'),0);assert.equal(await call('failure'),i===5?300:0);assert.equal((await db.query('select together_login_attempts_remaining($1) as n',[['email:alice','ip:one']])).rows[0].n,5-i);}
 assert.equal((await db.query('select together_login_limit($1,$2) as n',[['email:alice','ip:new-wifi'],'begin'])).rows[0].n,300,'changing IP does not bypass email lock');
 assert.equal(await call('begin'),300);
 await db.exec("update together_login_limits set locked_until=now()-interval '1 second'");
 assert.equal(await call('begin'),0);assert.equal(await call('success'),0);
 assert.equal((await db.query('select sum(failures) as n from together_login_limits')).rows[0].n,0);
 assert.equal(await call('begin'),0);assert.ok(await call('begin')>0,'concurrent request rejected');await call('release');
 await db.exec('set role authenticated');
 await assert.rejects(call('success'),/permission denied/);
 await db.exec('reset role');
 const hook=async valid=>(await db.query('select together_password_verification($1) as result',[{user_id:'test-user',valid}])).rows[0].result;
 for(let i=0;i<5;i++)await hook(false);
 assert.equal((await hook(true)).decision,'reject');
 await db.exec("update together_login_limits set locked_until=now()-interval '1 second'");
 assert.equal((await hook(true)).decision,'continue');
 assert.equal((await db.query("select failures from together_login_limits where key='auth:test-user'")).rows[0].failures,0);
 }finally{await db.close();}
});
