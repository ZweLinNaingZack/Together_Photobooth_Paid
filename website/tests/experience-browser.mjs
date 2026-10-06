// Isolated local-browser verification: no real camera, payment, email or account.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.text().startsWith('QA:'))console.log(msg.text());});
 await page.goto('http://127.0.0.1:5173/');
 const checks=await page.evaluate(async()=>{
  const {applyFilter}=await import('/src/booth/filterAsync.js');
  const {filterPixels,filters}=await import('/src/booth/core.js');
  for(const filter of Object.keys(filters)){
   const bytes=Uint8ClampedArray.from({length:64*64*4},(_,i)=>(i*17)%256);
   const expected=filterPixels(bytes.slice(),filter,17);
   const image=new ImageData(bytes,64,64);await applyFilter(image,filter,17);
   if(!image.data.every((v,i)=>v===expected[i]))throw Error('Worker mismatch: '+filter);
  }
  const {saveDraft,readDraft,deleteDraft,validDraft}=await import('/src/booth/recoveryStore.js');
  console.log('QA: worker filters matched');
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#df2935';ctx.fillRect(0,0,600,900);ctx.fillStyle='#1b70bf';ctx.fillRect(600,0,600,900);
  const photo=canvas.toDataURL('image/jpeg');
  const card={layout:'A',shots:[photo,photo,photo],template:null,filter:'vintage',color:'cherry',caption:'Together',design:'classic'};
  await saveDraft('qa-user',{card,sessionId:'11111111-1111-4111-8111-111111111111',mode:'solo',source:'upload'});
  const draft=await readDraft('qa-user');
  if(!draft||draft.card.shots[0]!==photo)throw Error('Draft did not round-trip');
  if(await readDraft('another-user'))throw Error('Wrong user sees draft');
  if(validDraft({...draft,expires:Date.now()-1}))throw Error('Expired draft accepted');
  if(validDraft({...draft,card:{...card,shots:[]}}))throw Error('Incomplete draft accepted');
  if(validDraft({...draft,card:{...card,layout:'unknown'}}))throw Error('Unknown layout accepted');
  await deleteDraft('qa-user');if(await readDraft('qa-user'))throw Error('Draft not deleted');
  const {snapshot,combinePortraits}=await import('/src/booth/cameraQuality.js');
  console.log('QA: recovery checks passed');
  Object.defineProperties(canvas,{videoWidth:{value:1200},videoHeight:{value:900},readyState:{value:4}});
  const left=snapshot(canvas,false,1),right=snapshot(canvas,true,1);
  console.log('QA: local photos captured');
  const combined=await combinePortraits(left,right);
  const image=new Image();image.src=combined;await image.decode();
  if(image.width!==1800||image.height!==900)throw Error('Original camera dimensions lost');
  const {recordDiagnostic,diagnosticReport}=await import('/src/booth/diagnostics.js');
  recordDiagnostic('private@example.test');recordDiagnostic('export_ready',200);
  if(diagnosticReport().includes('private@example.test'))throw Error('Diagnostics accept arbitrary data');
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {EditScreen}=await import('/src/booth/EditScreen.tsx');await import('/src/booth/journey.css');
  document.body.innerHTML='<main class="flow-booth" id="qa-editor"></main><div id="print-sheet"></div>';
  window.qaCard=card;window.qaRenderCount=0;
  const original=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(...args){window.qaRenderCount++;return original.apply(this,args);};
  createRoot(document.getElementById('qa-editor')).render(React.createElement(EditScreen,{card,onChange(){},onMove(){},onRetake(){},onBack(){},onDesign(){},onContinue(){},stage:'export'}));
  return {filters:Object.keys(filters).length,recovery:true,localPhoto:true};
 });
 await page.locator('#card-preview').waitFor();
 const downloadButton=page.getByRole('button',{name:/Download/}).first();
 const firstPromise=page.waitForEvent('download');await downloadButton.click();await firstPromise;
 const blobCount=await page.evaluate(()=>window.qaRenderCount);
 const secondPromise=page.waitForEvent('download');await downloadButton.click();await secondPromise;
 assert.equal(await page.evaluate(()=>window.qaRenderCount),blobCount,'repeat download reuses prepared blob');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile does not overflow');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({...checks,retryDownload:true,mobileOverflow:false}));
}finally{await browser.close();}
