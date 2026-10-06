import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {strongPassword} from '../src/auth/passwordPolicy.js';
import {makeLoginHandler} from '../api/password-login.mjs';
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
test('password policy requires all five classes',()=>{
 for(const value of ['Ab1!','abcdefgh1!','ABCDEFGH1!','Abcdefgh!','Abcdefgh1','Abcdefg1_'])assert.equal(strongPassword(value),false,value);
 for(const symbol of '!@#$%^&*(),.?":{}|<>')assert.equal(strongPassword(`Abcdefg1${symbol}`),true);
});
test('shared limiter locks fifth failure, resets on success and expires',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;');
 await db.exec(await readFile(new URL('../013-login-security.sql',import.meta.url),'utf8'));
 const call=async op=>(await db.query('select together_login_limit($1,$2) as seconds',[['email:alice','ip:one'],op])).rows[0].seconds;
 for(let i=1;i<=5;i++){assert.equal(await call('begin'),0);assert.equal(await call('failure'),i===5?300:0);}
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
