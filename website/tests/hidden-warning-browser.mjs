import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {WarningNotice}=await import('/src/components/WarningNotice.tsx');
  document.body.innerHTML='<div id="qa"></div>';
  window.qaClicks=0;
  createRoot(document.getElementById('qa')).render(React.createElement(React.StrictMode,null,
   React.createElement('button',{onClick:()=>window.qaClicks++},'Editor control'),
   React.createElement('div',{id:'camera-stage',hidden:true},React.createElement(WarningNotice,null,'Camera sharing interrupted'))));
 });
 await page.getByRole('button',{name:'Editor control'}).waitFor();
 await page.waitForTimeout(150);
 assert.equal(await page.locator('dialog[open]').count(),0,'hidden camera warning must not make editing inert');
 await page.getByRole('button',{name:'Editor control'}).click({timeout:2000});
 assert.equal(await page.evaluate(()=>window.qaClicks),1);
 await page.evaluate(()=>document.getElementById('camera-stage').hidden=false);
 await page.locator('dialog[open]').waitFor();
 await page.evaluate(()=>document.getElementById('camera-stage').hidden=true);
 await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 await page.getByRole('button',{name:'Editor control'}).click({timeout:2000});
 await page.evaluate(()=>document.getElementById('camera-stage').hidden=false);
 await page.getByRole('button',{name:'Got it'}).click();
 await page.waitForTimeout(150);
 assert.equal(await page.locator('dialog[open]').count(),0,'dismissed warning must stay closed');
 console.log('Hidden warning, stage transition, editor clicks and dismissal passed.');
}finally{await browser.close();}
