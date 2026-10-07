// Small capture commands are independent of bulk photo delivery. Originals are
// retained until both peers finish, so retry never resamples a different pose.
export function createDuoCaptures({guest,count,snapshot,combine,send,onPhoto,onPending,onError,onPreview=(_index,_photo)=>{},onCaptured=()=>{},timeoutMs=60000}){
 const entries=new Map(),latest=new Map(),early=new Map(),seen=new Set();let disposed=false;
 const current=e=>!disposed&&latest.get(e.index)===e.id;
 const notify=()=>{if(!disposed)onPending([...entries.values()].filter(e=>current(e)&&(!e.ready||!e.peerReady)).length);};
 function fail(e){if(!current(e)||e.ready&&e.peerReady)return;onError('Your photos are captured, but the original files have not finished syncing. Keep both pages open and retry photo sync.');notify();}
 function arm(e){clearTimeout(e.timer);e.timer=setTimeout(()=>fail(e),timeoutMs);}
 function create(id,index){
  const local=snapshot();
  const previous=entries.get(latest.get(index));if(previous){clearTimeout(previous.timer);entries.delete(previous.id);}
  const e={id,index,local,remote:null,ready:false,peerReady:false,finishing:false,timer:null};
  latest.set(index,id);entries.set(id,e);seen.add(id);if(seen.size>512)seen.delete(seen.values().next().value);arm(e);notify();onCaptured();return e;
 }
 function transmit(e){
  // A retry click or repeated capture command must not enqueue the same large
  // original repeatedly while it is already waiting for the data channel.
  if(e.transmission)return e.transmission;
  e.transmission=Promise.resolve().then(()=>send({type:'capture-original',id:e.id,index:e.index,photo:e.local})).finally(()=>{e.transmission=null;});
  return e.transmission;
 }
 function completed(e){return send({type:'capture-complete',id:e.id,index:e.index});}
 async function finish(e){
  if(!current(e)||!e.remote||e.finishing||e.ready)return;
  e.finishing=true;
  try{
   const photo=await combine(guest?e.remote:e.local,guest?e.local:e.remote);
   if(!current(e))return;
   e.ready=true;onPhoto(e.index,photo);notify();
   await completed(e);
   if(e.peerReady)clearTimeout(e.timer);
  }catch{fail(e);}finally{e.finishing=false;}
 }
 async function capture(index){
  if(guest||disposed)throw Error('Only the creator can take a photo.');
  const e=create(crypto.randomUUID(),index);
  try{
   // ACK confirms the partner has captured locally, not downloaded the JPEG.
   await send({type:'capture-local',id:e.id,index});
   if(!current(e))throw Error('This capture has ended.');
   void transmit(e).catch(()=>fail(e));
  }catch(error){fail(e);throw error;}
 }
 function receive(event){
  if(disposed||!['capture-local','capture-original','capture-complete','capture-missing'].includes(event.type))return;
  const {id,index}=event;if(typeof id!=='string'||id.length>80||!Number.isInteger(index)||index<0||index>=count)return;
  let e=entries.get(id);
  if(event.type==='capture-local'&&guest){
   if(!e&&(event.retry||seen.has(id))){void send({type:'capture-missing',id,index}).catch(()=>{});return;}
   try{e ||= create(id,index);void transmit(e).catch(()=>fail(e));const waiting=early.get(id);if(waiting){early.delete(id);receive(waiting);}}
   catch{onError('The camera could not capture this photo. Ask your creator to retake it.');void send({type:'capture-missing',id,index}).catch(()=>{});}
   return;
  }
  if(event.type==='capture-original'){
   if(typeof event.photo!=='string'||!event.photo.startsWith('data:image/jpeg;base64,')||event.photo.length>6000000)return;
   // Different RTC channels can deliver an original before its small command.
   if(!e){if(guest&&!seen.has(id)&&early.size<count)early.set(id,event);return;}
   if(!current(e)||e.index!==index)return;
   if(e.ready){void completed(e).catch(()=>fail(e));return;}
   e.remote=event.photo;void finish(e);
  }
  if(event.type==='capture-complete'&&e&&current(e)){e.peerReady=true;if(e.ready)clearTimeout(e.timer);notify();}
  if(event.type==='capture-missing'&&e&&current(e))onError('The other device no longer has this original photo. Please retake the unsynced photo together.');
 }
 async function retry(){
  const work=[...entries.values()].filter(e=>current(e)&&(!e.ready||!e.peerReady));
  await Promise.all(work.map(async e=>{arm(e);try{if(!guest)await send({type:'capture-local',id:e.id,index:e.index,retry:true});await transmit(e);if(e.ready)await completed(e);else await finish(e);}catch{fail(e);}}));
 }
 return {capture,receive,retry,pending:()=>[...entries.values()].some(e=>current(e)&&(!e.ready||!e.peerReady)),
  pendingIndex:()=>[...entries.values()].find(e=>current(e)&&(!e.ready||!e.peerReady))?.index??null,
  preview(index,photo){const e=entries.get(latest.get(index));if(e&&!e.ready)onPreview(index,photo);},
  dispose(){disposed=true;for(const e of entries.values())clearTimeout(e.timer);entries.clear();early.clear();latest.clear();}};
}
