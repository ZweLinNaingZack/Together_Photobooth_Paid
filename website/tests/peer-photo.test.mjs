import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jpegDimensions,validatePeerPhotos} from '../src/booth/peerPhoto.js';
import {combinePortraits} from '../src/booth/cameraQuality.js';
// Header fixtures exercise admission, not JPEG decoding. Browser smoke uses real JPEGs.
function jpeg(width,height,marker=0xc0,tail=[]){
 const bytes=[255,216,255,marker,0,17,8,height>>8,height&255,width>>8,width&255,3,1,17,0,2,17,0,3,17,0,255,218,0,12,3,1,0,2,17,3,17,0,63,0,...tail,255,217];
 return 'data:image/jpeg;base64,'+Buffer.from(bytes).toString('base64');
}
test('JPEG admission accepts normal baseline/progressive sizes and rejects pixel/aspect bombs and malformed structures',()=>{
 for(const marker of [0xc0,0xc2])assert.deepEqual(jpegDimensions(jpeg(1920,1440,marker)),{width:1920,height:1440});
 for(const photo of [jpeg(65535,65535),jpeg(8192,8192),jpeg(1,8192),jpeg(100,0),jpeg(100,100,0xc3),jpeg(100,100,0xc0,[255,220,0,4,255,255]),jpeg(100,100).slice(0,-4),'data:image/jpeg;base64,not-a-jpeg'])assert.throws(()=>jpegDimensions(photo));
 const a=Buffer.from(jpeg(100,100).split(',')[1],'base64');
 assert.throws(()=>jpegDimensions('data:image/jpeg;base64,'+Buffer.concat([a,a]).toString('base64')));
 assert.throws(()=>jpegDimensions(jpeg(100,100,0xc0,[255,192,0,17,8,0,100,0,100,3,1,17,0,2,17,0,3,17,0])));
});
test('all peer photo event variants use the same validation including legacy shot and photos',()=>{
 const good=jpeg(1800,900),bad=jpeg(65535,65535);
 for(const event of [{type:'capture-original',photo:bad},{type:'shot',shot:bad},{type:'photos',shots:[good,bad]},{type:'photos',shots:null}])assert.throws(()=>validatePeerPhotos(event));
 for(const event of [{type:'capture-original',photo:good},{type:'shot',shot:good},{type:'photos',shots:[good,'']},{type:'countdown',value:3}])assert.doesNotThrow(()=>validatePeerPhotos(event));
});
test('composition rejects either unsafe input before creating a decoder and caps its canvas',async()=>{
 const originalImage=globalThis.Image,originalDocument=globalThis.document;
 let created=0;const sizes=[],images=[];
 globalThis.Image=class {constructor(){created++;images.push(this);this.naturalWidth=900;this.naturalHeight=900;}set src(value){this.value=value;if(value)queueMicrotask(()=>this.onload?.());}};
 globalThis.document={createElement(){const canvas={width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL(){sizes.push([this.width,this.height]);return 'combined';}};return canvas;}};
 try{
  for(const args of [[jpeg(65535,1),jpeg(900,900)],[jpeg(900,900),jpeg(65535,1)]])await assert.rejects(combinePortraits(...args));
  assert.equal(created,0);
  assert.equal(await combinePortraits(jpeg(900,900),jpeg(900,900)),'combined');
  assert.deepEqual(sizes[0],[1800,900]);assert.ok(images.every(i=>i.value===''&&i.onload===null));
  globalThis.Image=class {constructor(){this.naturalWidth=100;this.naturalHeight=1600;}set src(value){if(value)queueMicrotask(()=>this.onload?.());}};
  await combinePortraits(jpeg(100,1600),jpeg(100,1600));assert.ok(sizes[1][1]<=2880);
 }finally{globalThis.Image=originalImage;globalThis.document=originalDocument;}
});
