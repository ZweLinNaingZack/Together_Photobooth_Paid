import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCameraTransport } from '../src/booth/cameraTransport.mjs';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function network() {
  const channels = new Set(), rows = [], writes = [], options = [];
  let dropAck = false;
  const client = {
    realtime: { setAuth: async () => {} },
    channel(topic, option) {
      options.push(option);
      const channel = {topic, subscribed:false,
        on(_,__,fn) { this.receive = fn; return this; },
        subscribe(fn) { this.subscribed=true; fn('SUBSCRIBED'); return this; },
        async send({payload}) {
          if (dropAck && payload.ack) return 'ok';
          for (const other of channels) if (other !== this && other.topic === topic && other.subscribed) other.receive({payload});
          return 'ok';
        },
      };
      channels.add(channel); return channel;
    },
    async removeChannel(channel) { channels.delete(channel); },
  };
  const request = role => async (action,body) => {
    if (action === 'signal') {
      writes.push(...body.messages);
      for (const message of body.messages) rows.push({id:rows.length+1,role,message});
      return {sent:true};
    }
    return {cursor:rows.length,messages:rows.filter(row=>row.role!==role && row.id>body.after)};
  };
  return {client,request,writes,options,dropAcks:()=>{dropAck=true;}};
}
const message = (id,type='candidate') => ({id,session:'session',type,candidate:{candidate:'test'}});

test('WebSocket handshake and ICE burst do not wait for HTTP or write the room', async () => {
  const net=network(), received=[];
  const slowRead = () => new Promise(()=>{});
  const host=createCameraTransport({client:net.client,topic:'booth:test',role:'host',request:slowRead,onMessage:m=>received.push(m)});
  const guest=createCameraTransport({client:net.client,topic:'booth:test',role:'guest',request:slowRead,onMessage:()=>{}});
  try {
    await wait(0);
    await Promise.all(Array.from({length:32},(_,id)=>guest.send(message(String(id)))));
    assert.equal(received.length,32);
    assert.equal(net.writes.length,0);
    assert.ok(net.options.every(option=>option.config.private===true));
  } finally {host.close();guest.close();}
});

test('lost browser ACK uses persisted fallback without duplicate processing', async () => {
  const net=network(), received=[];
  const host=createCameraTransport({client:net.client,topic:'booth:test',role:'host',request:net.request('host'),onMessage:m=>received.push(m)});
  const guest=createCameraTransport({client:net.client,topic:'booth:test',role:'guest',request:net.request('guest'),onMessage:()=>{},ackMs:10});
  try {
    await wait(0); net.dropAcks();
    await guest.send(message('one','offer'));
    await wait(850);
    assert.equal(net.writes.length,1);
    assert.equal(received.length,1);
  } finally {host.close();guest.close();}
});

test('a late or WebSocket-blocked peer receives the persisted greeting', async () => {
  const net=network(), received=[];
  const guest=createCameraTransport({client:net.client,topic:'booth:test',role:'guest',request:net.request('guest'),onMessage:()=>{},ackMs:10});
  let host;
  try {
    await wait(0); await guest.send(message('greeting','hello'));
    host=createCameraTransport({client:null,topic:null,role:'host',request:net.request('host'),onMessage:m=>received.push(m)});
    await wait(0);
    assert.equal(received[0].id,'greeting');
  } finally {host?.close();guest.close();}
});

test('closing while an ACK is pending cancels the fallback write', async () => {
  const net=network();
  const guest=createCameraTransport({client:net.client,topic:'booth:test',role:'guest',request:net.request('guest'),onMessage:()=>{},ackMs:10});
  await wait(0);
  const pending=guest.send(message('cancel','hello'));
  guest.close(); await pending; await wait(30);
  assert.equal(net.writes.length,0);
});

test('retry waits for asynchronous channel removal before subscribing again', async () => {
  const net=network();
  let finishRemoval;
  net.client.removeChannel=()=>new Promise(resolve=>{finishRemoval=resolve;});
  const options={client:net.client,topic:'booth:test',role:'guest',request:net.request('guest'),onMessage:()=>{}};
  const first=createCameraTransport(options);
  await wait(0); first.close();
  const second=createCameraTransport(options);
  try {
    await wait(0);
    assert.equal(net.options.length,1,'Must not reuse the closing channel');
    finishRemoval(); await wait(0);
    assert.equal(net.options.length,2);
  } finally {second.close();await wait(0);finishRemoval();}
});

test('WebSocket authorization failure preserves HTTP delivery', async () => {
  const net=network(), statuses=[];
  net.client.realtime.setAuth=async()=>{throw new Error('denied');};
  const guest=createCameraTransport({client:net.client,topic:'booth:test',role:'guest',request:net.request('guest'),onMessage:()=>{},onStatus:s=>statuses.push(s)});
  try {
    await wait(0); await guest.send(message('auth-fallback','hello'));
    assert.equal(net.writes.length,1);
    assert.ok(statuses.some(status=>status.includes('authorization failed')));
  } finally {guest.close();}
});
