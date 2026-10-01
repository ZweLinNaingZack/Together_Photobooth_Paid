import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('private signaling permits only ready paid room members, never outsiders or expired rooms', async () => {
  const db=new PGlite();
  const host='11111111-1111-4111-8111-111111111111', guest='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema realtime;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('test.topic',true) $$;
      create table realtime.messages(extension text);
      alter table realtime.messages enable row level security;
      grant usage on schema realtime,auth to authenticated;
      grant select,insert on realtime.messages to authenticated;
      create function public.together_room_has_ticket(invitation text,creator uuid) returns boolean language sql as $$ select current_setting('test.ticket',true)='yes' $$;`);
    await db.exec(await readFile(new URL('../004-hosted-rooms.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../008-camera-realtime.sql',import.meta.url),'utf8'));
    // Migration is safe to apply again.
    await db.exec(await readFile(new URL('../008-camera-realtime.sql',import.meta.url),'utf8'));
    const data={signalTopic:'booth:private',settings:{source:'camera'},host:{userId:host,ready:true},guest:{userId:guest,ready:true}};
    await db.query("insert into together_rooms(code,invite,data,expires_at) values('ABCDEF','invite',$1,now()+interval '45 minutes')",[data]);
    await db.exec("select set_config('test.ticket','yes',false); select set_config('test.topic','booth:private',false)");
    async function as(id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
      await db.exec('set role authenticated');
    }
    for (const member of [host,guest]) {
      await as(member);
      await db.exec("insert into realtime.messages values('broadcast')");
      assert.ok((await db.query('select * from realtime.messages')).rows.length);
      await assert.rejects(()=>db.query('select * from together_rooms'),/permission denied/);
      await assert.rejects(()=>db.exec("insert into realtime.messages values('presence')"),/row-level security/);
    }
    await as(outsider);
    assert.equal((await db.query('select * from realtime.messages')).rows.length,0);
    await assert.rejects(()=>db.exec("insert into realtime.messages values('broadcast')"),/row-level security/);
    await as(host);
    await db.exec("reset role; update together_rooms set data=jsonb_set(data,'{guest,ready}','false')");
    await as(host);
    assert.equal((await db.query('select * from realtime.messages')).rows.length,0);
    await db.exec("reset role; update together_rooms set data=jsonb_set(data,'{guest,ready}','true')");
    await as(host);
    await db.exec("select set_config('test.ticket','no',false)");
    assert.equal((await db.query('select * from realtime.messages')).rows.length,0);
    await db.exec("select set_config('test.ticket','yes',false); reset role; update together_rooms set expires_at=now()-interval '1 second'");
    await as(host);
    assert.equal((await db.query('select * from realtime.messages')).rows.length,0);
  } finally {await db.close();}
});
