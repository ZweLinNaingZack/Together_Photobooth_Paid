import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {supabaseRoomStore} from '../server/hosted-rooms.mjs';
async function database(){
 const db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;');
 for(const file of ['004-hosted-rooms.sql','013-login-security.sql','015-login-attempts.sql','018-resource-limits.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 return db;
}
test('locked IP cannot allocate email buckets; invalid CAPTCHA churn is bounded and cleaned',async()=>{
 const db=await database();try{
  const call=async(email,op='begin')=>(await db.query('select together_login_limit($1,$2) as n',[['email:'+email,'ip:one'],op])).rows[0].n;
  await db.exec("insert into together_login_limits(key,locked_until) values('ip:one',now()+interval '5 minutes')");
  for(let i=0;i<100;i++)assert.equal(await call(String(i)),300);
  assert.equal((await db.query('select count(*)::int n from together_login_limits')).rows[0].n,1);
  await db.exec('update together_login_limits set locked_until=null');
  for(let i=0;i<30;i++){assert.equal(await call(String(i)),0);await call(String(i),'release');}
  assert.ok(await call('blocked')>0);
  assert.equal((await db.query('select count(*)::int n from together_login_limits')).rows[0].n,1);
  await call('missing','failure');await call('missing','release');
  assert.equal((await db.query("select count(*)::int n from together_login_limits where key='email:missing'")).rows[0].n,0);
  await db.exec("insert into together_login_limits(key,updated_at) values('email:old',now()-interval '8 days'); insert into together_login_limits(key,updated_at,locked_until) values('email:locked',now()-interval '8 days',now()+interval '1 minute')");
  await db.query('select together_prune_login_limits()');
  assert.equal((await db.query("select count(*)::int n from together_login_limits where key='email:old'")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int n from together_login_limits where key='email:locked'")).rows[0].n,1);
  await db.exec('set role authenticated');await assert.rejects(db.query('select together_prune_login_limits()'),/permission denied/);
 }finally{await db.close();}
});
test('room quota is per owner, survives racing creates, releases on leave or stale presence, preserves CAS',async()=>{
 const db=await database();try{
  const data=(id,owner,seen=Date.now())=>({invite:id,expires:Date.now()+45*60000,host:{userId:owner,seen}});
  const save=async(id,version,body)=>(await db.query('select together_save_room($1,$2,$3) as ok',[id,version,body])).rows[0].ok;
  const results=await Promise.allSettled(Array.from({length:8},(_,i)=>save('r'+i,0,data('r'+i,'owner'))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
  assert.ok(results.filter(r=>r.status==='rejected').every(r=>/Owner room limit reached/.test(r.reason.message)));
  assert.equal(await save('other',0,data('other','another')),true);
  assert.equal(await save('r0',1,data('r0','owner')),true);
  assert.equal(await save('r0',1,data('r0','owner')),false);
  assert.equal(await save('r0',2,null),true);
  assert.equal(await save('replacement',0,data('replacement','owner')),true);
  await db.query("update together_rooms set data=jsonb_set(data,'{host,seen}',to_jsonb($1::numeric)) where code='replacement'",[Date.now()-61000]);
  assert.equal(await save('fresh',0,data('fresh','owner')),true);
  await assert.rejects(save('no-owner',0,{invite:'bad',expires:Date.now()+10000}),/Room owner required/);
  await db.exec('set role authenticated');await assert.rejects(save('forged',0,data('forged','someone')),/permission denied/);
 }finally{await db.close();}
});
test('owner quota errors have a usable retry message without exposing database details',async()=>{
 const store=supabaseRoomStore({rpc:async()=>({error:{message:'Owner room limit reached'}})});
 await assert.rejects(store.save('x',0,{}),e=>e.status===429&&/three open booths/.test(e.message));
});
