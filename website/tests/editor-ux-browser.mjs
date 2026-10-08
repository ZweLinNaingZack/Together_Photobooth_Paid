import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Bangkok'});
 await page.clock.setFixedTime(new Date('2026-10-07T06:00:00Z'));
 await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {EditScreen}=await import('/src/booth/EditScreen.tsx');await import('/src/booth/journey.css');
  document.body.innerHTML='<main class="flow-booth" data-current-step="design" id="ux-editor"></main>';
  const c=document.createElement('canvas');c.width=1200;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#be3345';ctx.fillRect(0,0,600,600);ctx.fillStyle='#1879ac';ctx.fillRect(600,0,600,600);const photo=c.toDataURL();
  function Test(){const [card,setCard]=React.useState({layout:'A',template:'film-negative',shots:[photo,photo,photo],filter:'original',caption:'Together',color:'cream',design:'classic'}),[stage,setStage]=React.useState('design');window.qaCard=card;return React.createElement(EditScreen,{card,onChange:p=>setCard(c=>({...c,...p})),onMove(){},onRetake(){},onBack(){},onDesign:()=>setStage('design'),onContinue:()=>setStage('export'),stage});}
  createRoot(document.getElementById('ux-editor')).render(React.createElement(Test));
 });
 await page.locator('#card-preview').waitFor();
 await page.getByLabel('Photo filter',{exact:true}).selectOption('noir');
 assert.equal(await page.evaluate(()=>window.qaCard.filter),'noir');
 assert.equal(await page.locator('.preview-workspace').evaluate(el=>getComputedStyle(el).position),'static','mobile preview scrolls with the page');
 assert.equal(await page.locator('.review-image img').first().evaluate(el=>getComputedStyle(el).objectFit),'contain','thumbnail shows complete photo');
 await page.screenshot({path:'../work/mobile-editor-check.png',fullPage:true});
 await page.getByRole('button',{name:'Expand & position photos'}).click();
 const modal=page.getByRole('dialog',{name:'Position your photos'});await modal.waitFor();
 await modal.screenshot({path:'../work/expanded-position-check.png'});
 assert.ok((await modal.boundingBox()).width<390,'expanded editor fits mobile');
 const slot=modal.locator('.photo-pan path').first();await slot.focus();await page.keyboard.press('ArrowLeft');
 assert.equal(await page.evaluate(()=>window.qaCard.offsets[0].x),.55);
 await page.getByRole('button',{name:'Done positioning'}).click();assert.equal(await modal.isVisible(),false);
 assert.equal(await page.evaluate(()=>window.qaCard.offsets[0].x),.55,'position survives closing expanded editor');
 await page.getByRole('button',{name:'Expand & position photos'}).click();await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),false);
 assert.equal(await page.locator('.film-date-thumb text').first().textContent(),'07.10.2026');
 await page.getByRole('button',{name:'Continue to export',exact:true}).click();
 assert.equal(await page.getByLabel('Photo filter',{exact:true}).count(),0);
 assert.equal(await page.locator('.finish-controls').count(),0);
 assert.equal(await page.locator('.final-preview .photo-pan').count(),0);
 assert.equal(await page.locator('#download-card').isVisible(),true);
 await page.getByRole('button',{name:'Done — Return to home'}).click();assert.equal(new URL(page.url()).hash,'');
 console.log('Expanded editing, persistent crop, Escape, local film date and Done navigation passed.');
}finally{await browser.close();}
