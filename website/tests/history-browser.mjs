import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {useStepHistory}=await import('/src/components/useStepHistory.ts');
  const {BoothDialog}=await import('/src/components/BoothDialog.tsx');
  document.body.innerHTML='<div id="test"></div>';
  function Test(){
   const [step,setStep]=React.useState('amount'),[pending,setPending]=React.useState(null);
   useStepHistory('test',true,step,(target,commit)=>{if(step==='payment')setPending(()=>commit);else commit();},setStep);
   return React.createElement(React.Fragment,null,React.createElement('h1',null,step),React.createElement('button',{onClick:()=>setStep('payment')},'Continue'),React.createElement(BoothDialog,{open:!!pending,title:'Change amount?',cancelLabel:'Stay',confirmLabel:'Change',onCancel:()=>setPending(null),onConfirm:()=>{pending();setPending(null);}},'Confirm'));
  }
  createRoot(document.getElementById('test')).render(React.createElement(Test));
 });
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.waitForTimeout(100);await page.evaluate(()=>history.back());
 await page.getByRole('button',{name:'Stay',exact:true}).click();
 assert.equal(await page.locator('h1').textContent(),'payment');
 await page.evaluate(()=>history.back());await page.getByRole('button',{name:'Change',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('h1').textContent==='amount');
 await page.evaluate(()=>history.forward());await page.waitForFunction(()=>document.querySelector('h1').textContent==='payment');
 console.log('Browser Back cancellation, confirmation, and Forward passed.');
}finally{await browser.close();}
