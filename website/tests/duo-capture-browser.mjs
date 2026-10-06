// Real local WebRTC and data channels with generated cameras and isolated signaling.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=no-user-gesture-required']});
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
  document.body.innerHTML='<div id="qa-duo"></div>';window.qaShots={host:[],guest:[]};window.qaConnected={};
  let n=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d');const color=n++?'#2277bb':'#dd3344';
   setInterval(()=>{ctx.fillStyle=color;ctx.fillRect(0,0,1200,900);ctx.fillStyle='white';ctx.fillText(String(Date.now()),20,20);},50);
   return canvas.captureStream(20);
  }});
  function Member({role}){
   const [card,setCard]=React.useState({layout:'A',shots:[],template:null,filter:'original',color:'cherry',caption:'Together',design:'classic'});
   const room={code:'LOCALQ',token:role,role,settings:{layout:'A',template:null,source:'camera'},host:{ready:true,online:true},guest:{ready:true,online:true},bothReady:true};
   return React.createElement('section',{'data-role':role},React.createElement(SessionScreen,{card,room,retake:null,method:'manual',seconds:3,restoreCamera:false,interrupted:false,flash:false,flashColor:'white',mirror:false,onMethod(){},onSeconds(){},onRetake(){},onBack(){},onNext(){},onMove(){},onFlashChange(){},onFlashColor(){},onMirrorChange(){},beforeReview:async()=>true,onPartnerConnection:value=>{window.qaConnected[role]=value;},onShot:(index,shot)=>setCard(c=>{const shots=[...c.shots];shots[index]=shot;window.qaShots[role]=shots;return {...c,shots};})}));
  }
  createRoot(document.getElementById('qa-duo')).render(React.createElement(React.Fragment,null,React.createElement(Member,{role:'host'}),React.createElement(Member,{role:'guest'})));
 });
 await page.waitForFunction(()=>window.qaConnected.host&&window.qaConnected.guest,{},{timeout:20000});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  const view=await page.locator('[data-role="host"] .session-view').boundingBox(),button=await page.locator('[data-role="host"] #capture-session').boundingBox();
  assert.ok(button.y-(view.y+view.height)<28&&button.y>=view.y+view.height,'shutter is directly below preview at '+width);
 }
 try{await page.locator('[data-role="host"] #capture-session').click({timeout:10000});}
 catch(e){console.log(await page.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({state:v.readyState,paused:v.paused,width:v.videoWidth,tracks:v.srcObject?.getTracks().map(t=>({ready:t.readyState,enabled:t.enabled,settings:t.getSettings()}))})),text:document.body.innerText})));throw e;}
 await page.waitForFunction(()=>window.qaShots.host.length===1&&window.qaShots.guest.length===1,{},{timeout:25000});
 const result=await page.evaluate(async()=>{const data=window.qaShots.host[0];const img=new Image();img.src=data;await img.decode();return {same:data===window.qaShots.guest[0],width:img.width,height:img.height};});
 assert.equal(result.same,true,'both members receive the identical full-quality still');
 assert.ok(result.width>1000&&result.height>=900,'still exceeds scaled video preview dimensions');
 await page.evaluate(()=>window.qaPeers[0].close());
 await page.waitForFunction(()=>window.qaPeers.length>2&&window.qaConnected.host&&window.qaConnected.guest,{},{timeout:30000});
 await page.locator('[data-role="host"] #capture-session').click({timeout:15000});
 await page.waitForFunction(()=>window.qaShots.host.length===2&&window.qaShots.guest.length===2,{},{timeout:25000});
 assert.equal(await page.evaluate(()=>window.qaShots.host[0]===window.qaShots.guest[0]&&window.qaShots.host[1]===window.qaShots.guest[1]),true,'reconnect retains old photos and can take another');
 console.log(JSON.stringify(result));
}finally{await browser.close();}
