import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {EditScreen}=await import('/src/booth/EditScreen.tsx');
  const {WarningNotice}=await import('/src/components/WarningNotice.tsx');
  await import('/src/booth/journey.css');
  document.body.innerHTML='<main class="flow-booth" id="test"></main>';
  const c=document.createElement('canvas');c.width=800;c.height=600;
  const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,800,300);ctx.fillStyle='blue';ctx.fillRect(0,300,800,300);
  const shot=c.toDataURL();
  function Test(){
   const [card,setCard]=React.useState({layout:'K',template:'music-player-k',shots:[shot,shot],filter:'original',caption:'Together',color:'cream'});
   const [options,setOptions]=React.useState({stage:'design',source:'camera',photosLocked:false});
   const [warning,setWarning]=React.useState('');
   window.testOptions=setOptions;window.testWarning=setWarning;window.testCard=card;
   return React.createElement(React.Fragment,null,React.createElement(EditScreen,{...options,card,onChange:p=>setCard(c=>({...c,...p})),onMove(){},onRetake(){},onBack(){},onDesign(){},onContinue(){}}),React.createElement(WarningNotice,null,warning));
  }
  createRoot(document.getElementById('test')).render(React.createElement(Test));
 });
 await page.locator('.photo-pan path').first().waitFor();
 for(const stage of ['design','export']) for(const source of ['camera','upload']) for(const photosLocked of [false,true]) {
  await page.evaluate(o=>window.testOptions(o),{stage,source,photosLocked});
  await page.locator('#track-title').fill(`${stage} ${source} title`);
  await page.locator('#track-subtitle').fill(`${source} subtitle`);
  assert.equal(await page.evaluate(()=>window.testCard.trackSubtitle),`${source} subtitle`);
  const slot=page.locator('.photo-pan path').first();
  await slot.focus();await page.keyboard.press('Home');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(150);
  const b=await slot.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2+30,{steps:5});await page.mouse.up();
  assert.notEqual(await page.evaluate(()=>window.testCard.offsets[0].y),.5,`${stage}/${source}/${photosLocked}: mouse pan`);
 }
 await page.evaluate(()=>window.testWarning('You need 100 points to continue.'));
 const dialog=page.getByRole('alertdialog');await dialog.waitFor({state:'visible'});
 assert.match(await dialog.textContent(),/100 points/);
 await dialog.getByRole('button',{name:'Got it'}).click();
 await page.waitForTimeout(100);assert.equal(await dialog.isVisible(),false,'dismiss stays dismissed');
 await page.evaluate(()=>window.testWarning(''));await page.waitForTimeout(50);
 await page.evaluate(()=>window.testWarning('You need 100 points to continue.'));
 await dialog.waitFor({state:'visible'});await page.keyboard.press('Escape');
 assert.equal(await dialog.isVisible(),false);
 console.log('Desktop title/subtitle and mouse pan passed in design/export, camera/upload, and unlocked/Duo guest modes. Warning dismiss/retry/Escape passed.');
} finally {await browser.close();}
