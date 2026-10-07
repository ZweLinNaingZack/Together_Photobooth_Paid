import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDuoCaptures} from '../src/booth/duoCaptures.mjs';
const photo=side=>'data:image/jpeg;base64,'+side;
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function pair(){
 const originals=[],photos=[[],[]],previews=[[],[]],pending=[0,0],errors=[],sampled=[0,0];let peers;
 peers=[false,true].map((guest,i)=>createDuoCaptures({guest,count:3,snapshot:()=>photo(`${i}-${++sampled[i]}`),combine:async(a,b)=>a+'|'+b,
  send:async event=>{if(event.type==='capture-original')originals.push({target:1-i,event});else peers[1-i].receive(event);},
  onPhoto:(index,p)=>photos[i][index]=p,onPreview:(index,p)=>previews[i][index]=p,onPending:n=>pending[i]=n,onError:e=>errors.push(e)}));
 return {peers,originals,photos,previews,pending,errors,sampled,deliver:async()=>{for(const {target,event} of originals.splice(0))peers[target].receive(event);await flush();},close:()=>peers.forEach(p=>p.dispose())};
}
test('shutter finishes and next photo captures while both original transfers are withheld',async()=>{
 const p=pair();try{
  await p.peers[0].capture(0);p.peers[0].preview(0,'temporary preview');
  await p.peers[0].capture(1);p.peers[0].preview(1,'second preview');
  assert.deepEqual(p.sampled,[2,2]);assert.deepEqual(p.pending,[2,2]);
  assert.equal(p.previews[0][0],'temporary preview');assert.equal(p.photos[0].length,0,'recovery/export never receive a temporary preview');assert.equal(p.photos[1].length,0);
  await p.deliver();assert.deepEqual(p.pending,[0,0]);assert.deepEqual(p.photos[0],p.photos[1]);
  p.peers[0].preview(0,'late preview');assert.notEqual(p.photos[0][0],'late preview');
 }finally{p.close();}
});
test('retry reuses originals rather than photographing a new pose',async()=>{
 const p=pair();try{await p.peers[0].capture(0);await flush();p.originals.length=0;await p.peers[0].retry();await p.deliver();assert.deepEqual(p.sampled,[1,1]);assert.deepEqual(p.pending,[0,0]);assert.deepEqual(p.photos[0],p.photos[1]);}finally{p.close();}
});
test('repeated retries share an original already in flight',async()=>{
 let release,originals=0;const blocked=new Promise(resolve=>release=resolve);
 const p=createDuoCaptures({guest:false,count:1,snapshot:()=>photo('test'),combine:async()=>'',
  send:event=>{if(event.type==='capture-original'){originals++;return blocked;}return Promise.resolve();},
  onPhoto:()=>{},onPending:()=>{},onError:()=>{}});
 try{await p.capture(0);const retries=[p.retry(),p.retry()];await flush();assert.equal(originals,1);release();await Promise.all(retries);}finally{release();p.dispose();}
});
test('a late original cannot overwrite a newer retake and disposal ignores late transfers',async()=>{
 const p=pair();try{await p.peers[0].capture(0);const old=p.originals.splice(0);await p.peers[0].capture(0);await p.deliver();const final=p.photos[0][0];for(const m of old)p.peers[m.target].receive(m.event);await flush();assert.equal(p.photos[0][0],final);p.close();for(const m of old)p.peers[m.target].receive(m.event);assert.equal(p.photos[0][0],final);}finally{p.close();}
});
