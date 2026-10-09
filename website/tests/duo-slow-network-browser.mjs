// Real local WebRTC and data channels with generated cameras and isolated signaling.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{channel:'msedge'}),args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage();
 await page.route('**/src/booth/rooms.ts',r=>r.fulfill({contentType:'application/javascript',body:'export async function roomRequest(){return {iceServers:[],relayConfigured:false};}'}));
 await page.route('**/src/booth/cameraTransport.mjs',r=>r.fulfill({contentType:'application/javascript',body:`const members=new Set();export function createCameraTransport(options){members.add(options);return {send:async message=>{for(const peer of members)if(peer!==options)queueMicrotask(()=>peer.onMessage(message));},close:()=>members.delete(options)};}`}));
 await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {SessionScreen}=await import('/src/booth/SessionScreen.tsx');
  await import('/src/booth/journey.css');
  const NativePeer=window.RTCPeerConnection;window.qaPeers=[];window.RTCPeerConnection=class extends NativePeer{constructor(...args){super(...args);window.qaPeers.push(this);}};
  // Session-4 simulation: full photos take 40 s to arrive.
  const originalSend=RTCDataChannel.prototype.send;
  RTCDataChannel.prototype.send=function(data){if(this.label==='together'){setTimeout(()=>{if(this.readyState==='open')originalSend.call(this,data);},window.qaDelay??1800);}else originalSend.call(this,data);};
  document.body.innerHTML='<div id="qa-duo"></div>';window.qaShots={host:[],guest:[]};window.qaConnected={};window.qaEditing={};window.qaConfirmations=0;
  let n=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d');const color=n++?'#2277bb':'#dd3344';
   setInterval(()=>{ctx.fillStyle=color;ctx.fillRect(0,0,1200,900);ctx.fillStyle='white';ctx.fillText(String(Date.now()),20,20);},50);
   return canvas.captureStream(20);
  }});
  function Member({role}){
   const [card,setCard]=React.useState({layout:'A',shots:[],template:null,filter:'original',color:'cherry',caption:'Together',design:'classic'});
   const room={code:'LOCALQ',token:role,role,settings:{layout:'A',template:null,source:'camera'},host:{ready:true,online:true},guest:{ready:true,online:true},bothReady:true};
   return React.createElement('section',{'data-role':role},React.createElement(SessionScreen,{card,room,retake:null,method:'manual',seconds:3,restoreCamera:false,interrupted:false,flash:false,flashColor:'white',mirror:false,onMethod(){},onSeconds(){},onRetake(){},onBack(){},onNext(){window.qaEditing[role]=true;},onMove(){},onFlashChange(){},onFlashColor(){},onMirrorChange(){},beforeReview:async()=>{window.qaConfirmations++;return true;},onPartnerConnection:value=>{window.qaConnected[role]=value;},onShot:(index,shot)=>setCard(c=>{const shots=[...c.shots];shots[index]=shot;window.qaShots[role]=shots;return {...c,shots};})}));
  }
  createRoot(document.getElementById('qa-duo')).render(React.createElement(React.StrictMode,null,React.createElement(Member,{role:'host'}),React.createElement(Member,{role:'guest'})));
 });
 await page.waitForFunction(()=>window.qaConnected.host&&window.qaConnected.guest,{},{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('[data-role="host"] video[aria-label="Your person’s live camera"]')?.videoWidth>=320,{},{timeout:15000});
 const encodings=await page.evaluate(()=>window.qaPeers.filter(p=>p.connectionState==='connected').flatMap(p=>p.getSenders().flatMap(s=>s.getParameters().encodings||[])));
 assert.ok(encodings.length===2&&encodings.every(e=>e.maxBitrate>=600000&&e.maxBitrate<=2400000&&e.scaleResolutionDownBy>=1),'both senders use bounded adaptive preview settings');
 await page.evaluate(()=>{window.qaDelay=40000;});
 for(let i=0;i<3;i++){
  await page.locator('[data-role="host"] #capture-session').click({timeout:10000});
  await page.waitForFunction(n=>document.querySelectorAll('[data-role="host"] .review-image img').length===n&&!document.querySelector('[data-role="host"] #capture-session')?.disabled,i+1,{timeout:5000}).catch(()=>{});
 }
 await page.waitForFunction(()=>document.querySelectorAll('[data-role="host"] .review-image img').length===3,{},{timeout:10000});
 const started=Date.now();
 await page.locator('[data-role="host"]').getByRole('button',{name:'Continue to editing'}).click();
 await page.waitForFunction(()=>window.qaEditing.host&&window.qaEditing.guest,{},{timeout:20000});
 const waited=Date.now()-started;
 const filled=await page.evaluate(()=>({host:window.qaShots.host.filter(Boolean).length,guest:window.qaShots.guest.filter(Boolean).length}));
 assert.equal(filled.host,3,'host continues with previews in every slot');assert.equal(filled.guest,3,'guest continues with previews in every slot');
 assert.ok(waited<14000,'moved on within the short wait, not stuck: '+waited+' ms');
 const before=await page.evaluate(()=>window.qaShots.host[0]);
 await page.waitForFunction(first=>window.qaShots.host[0]!==first&&window.qaShots.host[0]===window.qaShots.guest[0],before,{timeout:60000});
 const upgraded=await page.evaluate(async()=>{const img=new Image();img.src=window.qaShots.host[0];await img.decode();return {width:img.width,height:img.height};});
 assert.ok(upgraded.width>1000,'full-quality photo replaced the preview after arriving');
 console.log(JSON.stringify({movedOnAfterMs:waited,upgradedWidth:upgraded.width,previewsThenFull:true}));
}finally{await browser.close();}
