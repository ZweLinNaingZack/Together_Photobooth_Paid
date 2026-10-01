import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createHostedRoomService } from '../server/hosted-rooms.mjs';

test('hosted rooms persist across instances, handle racing joins and protect member identity', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../004-hosted-rooms.sql',import.meta.url),'utf8'));
  let conflictingWrites = 0, turnCalls = 0;
  const store = {
   async limit(bucket,maximum) { return (await db.query('select together_room_limit($1,$2) as value',[bucket,maximum])).rows[0].value; },
   async load(body) { return (await db.query(`select data,version from together_rooms where ${body.invite ? 'invite' : 'code'}=$1`,[body.invite || body.code])).rows[0]; },
   async save(code,version,data) { if (conflictingWrites > 0) { conflictingWrites--; return false; } return (await db.query('select together_save_room($1,$2,$3) as value',[code,version,data ? JSON.stringify(data) : null])).rows[0].value; }
  };
  const service = () => createHostedRoomService({store,rtcConfig:async()=>{turnCalls++; return {iceServers:[{urls:'turn:test',username:'test',credential:'test'}],relayConfigured:true};}});
  const run = (action,body,user) => service().run(action,body,user);
  await assert.rejects(()=>run('create',{},null),/sign in/);
  const host=await run('create',{settings:{layout:'A',source:'camera',template:null}},'host');
  const joins=await Promise.allSettled([run('join',{invite:host.invite},'guest'),run('join',{invite:host.invite},'other')]);
  assert.equal(joins.filter(r=>r.status==='fulfilled').length,1);
  const winner=joins.findIndex(r=>r.status==='fulfilled');
  const guest=joins[winner].value, guestId=winner===0?'guest':'other';
  await assert.rejects(()=>run('state',{code:host.code,token:host.token},'attacker'),/not connected/);
  await run('ready',{code:host.code,token:host.token,ready:true},'host');
  const ready=await run('ready',{code:guest.code,token:guest.token,ready:true},guestId);
  assert.equal(ready.bothReady,true);
  await Promise.all([1,2].map(id=>run('signal',{code:host.code,token:host.token,message:{type:'hello',session:'test',id:String(id)}},'host')));
  const messages=await run('signals',{code:guest.code,token:guest.token,after:0},guestId);
  assert.equal(messages.messages.length,2);
  const beforePolls = await store.load({code:host.code});
  conflictingWrites = 100;
  const reads = await Promise.all(Array.from({length:12},()=>run('signals',{code:guest.code,token:guest.token,after:0},guestId)));
  assert.ok(reads.every(result=>result.messages.length===2));
  assert.equal(conflictingWrites,100,'Polling must never try a competing room write');
  assert.equal((await store.load({code:host.code})).version,beforePolls.version);
  await assert.rejects(()=>run('signals',{code:host.code,token:host.token,after:0},'attacker'),/not connected/);
  conflictingWrites = 3; // Heartbeats race with the slow TURN request.
  const rtc=await run('rtc',{code:host.code,token:host.token},'host');
  assert.equal(turnCalls,1, 'Room version conflicts must not generate TURN credentials repeatedly');
  assert.equal(conflictingWrites,3,'TURN setup must not wait for any competing room write');
  assert.match(rtc.signalTopic,/^booth:/);
  assert.equal(rtc.relayConfigured,true);
  assert.deepEqual(await run('rtc',{code:host.code,token:host.token},'host'),rtc);
  assert.equal(turnCalls,2, 'Each API request issues credentials without writing room state; the browser caches them');
  conflictingWrites = 0;
  await run('leave',{code:host.code,token:host.token},'host');
  await assert.rejects(()=>run('state',{code:guest.code,token:guest.token},guestId),/expired/);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select * from together_rooms'),/permission denied/);
  await assert.rejects(()=>db.query("select together_room_limit('x',100)"),/permission denied/);
 } finally {await db.close();}
});
