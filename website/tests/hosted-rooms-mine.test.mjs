import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createHostedRoomService } from '../server/hosted-rooms.mjs';

// 'mine' lets a device that lost its saved copy find the account's own open seat.
test('mine returns only the caller’s own seat and nothing after the room closes', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;');
  for (const name of ['004-hosted-rooms.sql','013-login-security.sql','018-resource-limits.sql']) await db.exec(await readFile(new URL(`../${name}`,import.meta.url),'utf8'));
  const store = {
   async limit(bucket,maximum) { return (await db.query('select together_room_limit($1,$2) as value',[bucket,maximum])).rows[0].value; },
   async load(body) { return (await db.query(`select data,version from together_rooms where ${body.invite ? 'invite' : 'code'}=$1`,[body.invite || body.code])).rows[0]; },
   async save(code,version,data) { return (await db.query('select together_save_room($1,$2,$3) as value',[code,version,data ? JSON.stringify(data) : null])).rows[0].value; },
   async findMine(user) { return (await db.query("select data,version from together_rooms where (data->'host'->>'userId'=$1 or data->'guest'->>'userId'=$1) and expires_at>now()",[user])).rows; },
  };
  const run = (action,body,user) => createHostedRoomService({store,rtcConfig:async()=>({iceServers:[],relayConfigured:false})}).run(action,body,user);
  const host = await run('create',{settings:{layout:'A',source:'camera',template:null}},'host');
  const guest = await run('join',{invite:host.invite},'guest');
  assert.deepEqual((await run('mine',{},'host')).room,{code:host.code,token:host.token,role:'host',invite:host.invite});
  assert.deepEqual((await run('mine',{},'guest')).room,{code:host.code,token:guest.token,role:'guest'},'guests never receive the invite');
  assert.equal((await run('mine',{},'stranger')).room,null,'other accounts see nothing');
  await assert.rejects(() => run('mine',{},null),/sign in/);
  await run('leave',{code:host.code,token:host.token},'host');
  assert.equal((await run('mine',{},'host')).room,null,'a closed room is not offered');
 } finally { await db.close(); }
});
