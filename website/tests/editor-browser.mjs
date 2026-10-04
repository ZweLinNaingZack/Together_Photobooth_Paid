// Local, isolated editor QA. No real accounts, camera, or payments are used.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
 const page = await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
   const React=(await import('/node_modules/.vite/deps/react.js')).default;
   const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
   const {EditScreen}=await import('/src/booth/EditScreen.tsx');
   await import('/src/booth/journey.css');
   document.body.innerHTML='<main class="flow-booth" id="editor-test"></main>';
   const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#bea28c';ctx.fillRect(0,0,800,600);ctx.fillStyle='#fff';ctx.font='80px sans-serif';ctx.fillText('Test photo',140,320);
   const shot=canvas.toDataURL();
   function Test(){const [card,setCard]=React.useState({layout:'K',template:'music-player-k',shots:[shot,shot],filter:'original',caption:'Together',color:'cream',design:'classic',trackTitle:'A song for us'});return React.createElement(EditScreen,{card,onChange:p=>setCard(c=>({...c,...p})),onMove(){},onRetake(){},onBack(){},onDesign(){},onContinue(){},stage:'design'});}
   createRoot(document.getElementById('editor-test')).render(React.createElement(Test));
 });
 await page.locator('#card-preview').waitFor();
 await page.locator('#track-subtitle').fill('Our favorite artist');
 await page.waitForTimeout(200);
 const beforeDrag=await page.locator('#card-preview').getAttribute('src');
 const slot=page.locator('.photo-pan path').first();
 const slotBox=await slot.boundingBox();
 await page.mouse.move(slotBox.x+slotBox.width/2,slotBox.y+slotBox.height/2);
 await page.mouse.down();await page.mouse.move(slotBox.x+slotBox.width/2,slotBox.y+slotBox.height/2+35,{steps:5});await page.mouse.up();
 await page.waitForTimeout(200);
 assert.notEqual(await page.locator('#card-preview').getAttribute('src'),beforeDrag,'drag changes photo crop');
 await slot.focus();await page.keyboard.press('Home');await page.waitForTimeout(200);
 assert.equal(await page.locator('#card-preview').getAttribute('src'),beforeDrag,'Home restores centered crop');
 const cdp=await page.context().newCDPSession(page);
 const tx=slotBox.x+slotBox.width/2,ty=slotBox.y+slotBox.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty-30}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(200);
 assert.notEqual(await page.locator('#card-preview').getAttribute('src'),beforeDrag,'touch drag changes photo crop');
 await slot.focus();await page.keyboard.press('Home');await page.waitForTimeout(200);
 await page.locator('#card-preview').screenshot({path:'../work/music-title-preview.png'});
 await page.locator('#track-title').fill('A very long song title that should fit without breaking art');
 await page.waitForTimeout(500);
 await page.evaluate(()=>window.scrollTo({top:400,behavior:'instant'}));
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');
 const before=await page.evaluate(()=>scrollY);
 await page.locator('.frame-carousel').evaluate(el=>{el.scrollLeft=0;});
 await page.locator('.frame-carousel .card-design-option').first().click();
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>scrollY),before,'selection must preserve vertical scroll');
 const box=await page.locator('.preview-workspace').boundingBox();
 assert.ok(box.y>=-1 && box.y<30,'preview remains pinned');
 await page.screenshot({path:'../work/editor-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:'../work/editor-desktop.png'});
 await page.route('**/frames/movie-time-k-redesigned.png',async route=>{
   await new Promise(resolve=>setTimeout(resolve,1500));await route.continue();
 });
 await page.locator('.frame-carousel .card-design-option').nth(1).click();
 assert.equal(await page.locator('.chosen-design-note strong').textContent(),'Movie Time','selection updates before artwork finishes');
 await page.locator('.frame-carousel .card-design-option').first().click();
 assert.equal(await page.locator('.chosen-design-note strong').textContent(),'Ticket Memories','slow artwork never blocks switching again');
 await page.waitForTimeout(1700);
 assert.equal(await page.locator('.chosen-design-note strong').textContent(),'Ticket Memories','late artwork never replaces current selection');
 const rendered=await page.evaluate(async()=>{
   const {renderCard}=await import('/src/booth/renderCard.js');
   const shot=document.querySelector('#card-preview').src;
   const canvas=await renderCard({layout:'K',template:'music-player-k',shots:[shot,shot],filter:'original',trackTitle:'A song for us'});
   return {width:canvas.width,height:canvas.height};
 });
 assert.equal(rendered.width,2528);
 console.log('Mobile scroll, sticky preview, frame selection, title input, and full-resolution export checks passed.');
} finally {await browser.close();}
