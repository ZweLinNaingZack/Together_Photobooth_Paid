// Generates the wordmark PNG and visual QA previews without sending email.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {paymentEmail} from '../server/payment-email.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:700,height:1100},deviceScaleFactor:2});
 await page.setContent('<body style="margin:0"><div id="logo" style="width:400px;height:90px;display:flex;align-items:center;justify-content:center;font:64px Arial,sans-serif;letter-spacing:-4px;color:#252b26;background:#f5f1e8">together<span style="color:#a82c3c;letter-spacing:0;margin-left:10px">✳</span></div></body>');
 await page.locator('#logo').screenshot({path:'public/email-logo.png'});
 await mkdir('../work/email-previews',{recursive:true});
 for(const event of ['pending','approved','rejected']){
  const message=paymentEmail({event,payload:{orderId:'ae847501-4812-4b51-8a72-8041ef849341',userId:'11111111-1111-4111-8111-111111111111',name:'Sample Customer',email:'customer@example.com',date:'2026-10-04T12:00:00Z',amount:21000,points:300,balance:500,reference:'KBZ-12345678',reason:'The amount received does not match this request. Please contact us.'}},{siteUrl:'https://example.com',supportEmail:'support@example.com'});
  for(const width of [700,375]){
   await page.setViewportSize({width,height:1100});await page.setContent(message.html);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Email overflow');
   await page.screenshot({path:`../work/email-previews/${event}-${width}.png`,fullPage:true});
  }
 }
}finally{await browser.close();}
