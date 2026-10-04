import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('wallet and top-ups isolate users and credit approved transfers exactly once', async () => {
  const db = new PGlite();
  const admin = '11111111-1111-4111-8111-111111111111';
  const alice = '22222222-2222-4222-8222-222222222222';
  const bob = '33333333-3333-4333-8333-333333333333';
  const unverified = '44444444-4444-4444-8444-444444444444';
  try {
    // Minimal Supabase schemas. Storage HTTP size/MIME validation needs live QA.
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, storage to anon, authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      insert into auth.users values
        ('${admin}','zwelinnaing34@gmail.com',now()),
        ('${alice}','alice@example.test',now()),('${bob}','bob@example.test',now()),
        ('${unverified}','unverified@example.test',null);`);
    await db.exec("alter table auth.users add column raw_user_meta_data jsonb default '{}'::jsonb");
    await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [JSON.stringify({ full_name: 'Alice Example' }), alice]);
    for (const name of ['001-wallet-foundation.sql', '002-topups.sql', '003-correct-topup-pricing.sql', '004-hosted-rooms.sql', '005-session-charges.sql', '006-admin-order-identities.sql']) {
      await db.exec(await readFile(new URL(`../${name}`, import.meta.url), 'utf8'));
    }
    async function as(id, role = 'authenticated') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec(`set role ${role}`);
    }
    async function wallet() { return (await db.query('select public.together_my_wallet() as wallet')).rows[0].wallet; }
    async function start() { return (await db.query('select * from public.together_start_topup()')).rows[0]; }
    async function upload(r) { await db.query("insert into storage.objects(bucket_id,name) values ('together-receipts',$1)", [`${r.user_id}/${r.id}/receipt`]); }
    async function submit(r) { return db.query('select * from public.together_submit_topup($1)', [r.id]); }
    async function review(r, approve, ref, note = '') { return db.query('select * from public.together_review_topup($1,$2,$3,$4)', [r.id, approve, ref, note]); }

    await as('', 'anon'); await assert.rejects(wallet, /permission denied/);
    await as(unverified); await assert.rejects(start, /verified account/);
    await as(alice);
    assert.equal((await wallet()).points, 0);
    assert.equal((await wallet()).trial_available, true);
    assert.equal((await wallet()).is_admin, false);
    const first = await start(); assert.equal((await start()).id, first.id);
    await assert.rejects(() => submit(first), /Upload a receipt/);
    await upload(first); await submit(first); await submit(first);
    await assert.rejects(() => review(first,true,'BANK123'), /Administrator required/);
    await assert.rejects(() => db.exec("update public.together_accounts set trial_used_at = now()"), /permission denied/);
    await assert.rejects(() => db.query('insert into public.together_admins(user_id) values ($1)',[alice]), /permission denied/);
    await as(bob); await wallet();
    await assert.rejects(() => db.query('select together_admin_orders()'), /Administrator required/);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    assert.equal((await db.query('select * from public.together_topups')).rows.length, 0);
    await assert.rejects(() => submit(first), /Request unavailable/);
    await assert.rejects(() => upload(first), /row-level security/);
    const second = await start(); await upload(second); await submit(second);
    await as(admin); assert.equal((await wallet()).is_admin, true);
    const orders = (await db.query('select together_admin_orders() as orders')).rows[0].orders;
    assert.equal(orders.find(r => r.id === first.id).customer_email, 'alice@example.test');
    assert.equal(orders.find(r => r.id === first.id).customer_name, 'Alice Example');
    assert.equal((await db.query('select * from storage.objects')).rows.length, 2);
    await review(first,true,'bank-123'); await review(first,true,'bank-123');
    await assert.rejects(() => review(first,false,'','Changed mind'), /Only pending/);
    await assert.rejects(() => review(second,true,'BANK123'), /unique constraint/);
    assert.equal((await db.query('select status from public.together_topups where id=$1',[second.id])).rows[0].status,'pending');
    await review(second,false,'','No matching incoming transaction');
    await as(alice); assert.equal((await wallet()).points, 100); assert.equal((await wallet()).history.length, 1);
    await assert.rejects(() => db.exec("insert into public.together_credit_ledger(user_id,points,kind,reference) values ('"+alice+"',100,'topup',gen_random_uuid())"), /permission denied/);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    // Uploaded receipt cannot be replaced after approval.
    assert.equal((await db.query("update storage.objects set name='changed' returning id")).rows.length, 0);
    await as(bob); assert.equal((await wallet()).points, 0);
    const free = '55555555-5555-4555-8555-555555555555';
    const paid = '66666666-6666-4666-8666-666666666666';
    const extra = '77777777-7777-4777-8777-777777777777';
    const complete = async (id, room = null) => (await db.query('select together_complete_session($1,$2) as receipt',[id,room])).rows[0].receipt;
    await as('', 'anon'); await assert.rejects(() => complete(free), /permission denied/);
    await as(unverified); await assert.rejects(() => complete(free), /verified account/);
    await db.exec('reset role');
    await db.query("insert into together_rooms(code,invite,data,expires_at) values ('TESTAA','unique-invite',$1,now()+interval '1 hour')",[JSON.stringify({host:{userId:alice},invite:'unique-invite'})]);
    await as(bob); await assert.rejects(() => complete(free,'TESTAA'), /Only the creator/);
    assert.equal((await wallet()).trial_available,true, 'guest trial remains available');
    await as(alice);
    const receipts = await Promise.all([complete(free,'TESTAA'),complete(free,'TESTAA')]);
    assert.equal(receipts[0].used_trial,true);
    assert.equal((await wallet()).trial_available,false);
    assert.equal((await wallet()).points,100);
    assert.equal((await complete(extra,'TESTAA')).used_trial,true, 'same room cannot charge twice with a new request ID');
    await complete(paid); await complete(paid);
    assert.equal((await wallet()).points,0);
    assert.equal((await wallet()).history.filter(row => row.kind === 'session').length,1);
    await assert.rejects(() => complete(extra), /need 100 points/);
    await as(bob); await assert.rejects(() => complete(paid), /Session unavailable/);
    assert.equal((await wallet()).trial_available,true);
    await assert.rejects(() => db.exec('update together_sessions set used_trial = false'), /permission denied/);
    await db.exec('reset role; create role supabase_auth_admin;');
    await db.exec(await readFile(new URL('../007-auth-and-reservations.sql',import.meta.url),'utf8'));
    await as(admin,'supabase_auth_admin');
    const signup = async (email,provider) => (await db.query('select together_before_user_created($1) as result',[{user:{email,app_metadata:{provider}}}])).rows[0].result;
    assert.deepEqual(await signup('new@gmail.com','email'),{});
    assert.deepEqual(await signup('new@gmail.com','google'),{});
    for (const email of ['new@outlook.com','new@yahoo.com','new@icloud.com','new@gmail.com.evil.test']) assert.equal((await signup(email,'email')).error.http_code,403);
    assert.equal((await signup('new@gmail.com','discord')).error.http_code,403);
    await db.exec('reset role');
    await db.query('update auth.users set email=$1 where id=$2',['shared.mail@gmail.com',bob]);
    await db.query('update auth.users set email=$1,email_confirmed_at=now() where id=$2',['sharedmail+alias@gmail.com',unverified]);
    const action = async (id,operation,room=null) => (await db.query('select together_session_action($1,$2,$3) as result',[id,operation,room])).rows[0].result;
    await as(bob);
    await assert.rejects(() => complete(extra),/reservation expired/);
    await action(extra,'reserve');
    assert.equal((await wallet()).trial_reserved,true);
    await as(unverified);
    await assert.rejects(() => action(free,'release'),/Session unavailable/);
    await assert.rejects(() => action('88888888-8888-4888-8888-888888888888','reserve'),/need 100 points/);
    await as(bob);
    await action(extra,'release');
    assert.equal((await wallet()).trial_reserved,false);
    await action(extra,'reserve');
    await db.exec('reset role');
    await db.query("update together_reservations set expires_at=now()-interval '1 minute' where id=$1",[extra]);
    await as(bob);
    await assert.rejects(() => complete(extra),/reservation expired/);
    await action(extra,'reserve');
    await complete(extra); await complete(extra);
    await as(unverified);
    assert.equal((await wallet()).trial_available,false,'Gmail aliases share the consumed trial');
    await assert.rejects(() => action('88888888-8888-4888-8888-888888888888','reserve'),/need 100 points/);
    await assert.rejects(() => db.query('select * from together_trial_mailboxes'),/permission denied/);
    await as(alice);
    assert.equal((await wallet()).trial_available,false,'Existing consumed trials stay consumed');
    await db.exec('reset role');
    await db.query("insert into together_credit_ledger(user_id,points,kind,reference) values($1,100,'topup',gen_random_uuid())",[alice]);
    const nextId='99999999-9999-4999-8999-999999999999';
    await as(alice);
    assert.equal((await action(nextId,'reserve')).used_trial,false);
    assert.equal((await wallet()).reserved_points,100);
    assert.equal((await wallet()).points,100,'Reservation does not deduct until completion');
    await assert.rejects(() => action('88888888-8888-4888-8888-888888888888','reserve'),/active booth/);
    await complete(nextId); await complete(nextId);
    assert.equal((await wallet()).points,0);
    assert.equal((await wallet()).reserved_points,0);
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../009-variable-topups.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../010-edit-draft-topup.sql', import.meta.url), 'utf8'));
    await as(alice);
    for (const points of [null, 0, 50, 101, -100, 10100]) {
      await assert.rejects(() => db.query('select * from together_start_topup($1)', [points]), /steps of 100/);
    }
    const bulk = (await db.query('select * from together_start_topup($1)', [300])).rows[0];
    assert.equal(bulk.points, 300); assert.equal(bulk.amount_mmk, 21000);
    await as(bob);
    await assert.rejects(() => db.query('select together_change_topup($1,200)',[bulk.id]), /Request unavailable/);
    await as(alice);
    const changed=(await db.query('select * from together_change_topup($1,200)',[bulk.id])).rows[0];
    assert.equal(changed.amount_mmk,14000); assert.equal(changed.points,200);
    await db.query('select together_change_topup($1,300)',[bulk.id]);
    assert.equal((await start()).id, bulk.id, 'retry returns original order without changing its total');
    await upload(bulk);
    await assert.rejects(() => db.query('select together_change_topup($1,200)',[bulk.id]), /receipt is already saved/);
    await submit(bulk);
    await assert.rejects(() => db.query('select together_change_topup($1,200)',[bulk.id]), /Only unpaid drafts/);
    await as(admin);
    const bulkOrders = (await db.query('select together_admin_orders() as orders')).rows[0].orders;
    assert.equal(bulkOrders.find(r => r.id === bulk.id).amount_mmk, 21000);
    await review(bulk, true, 'BANK-BULK-300'); await review(bulk, true, 'BANK-BULK-300');
    await as(alice); assert.equal((await wallet()).points, 300, 'bulk approval credits the selected points exactly once');
  } finally { await db.close(); }
});
