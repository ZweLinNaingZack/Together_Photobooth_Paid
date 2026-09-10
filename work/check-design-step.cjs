const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root='work/design-step/';const designs=JSON.parse(fs.readFileSync(root+'designs.json','utf8'));const source=fs.readFileSync(root+'booth-flow.js','utf8');
assert.equal(Object.keys(designs).length,10);assert(!source.includes('const sampleDesigns='));assert(source.includes("showStep('design')"));assert(source.includes('design:designScreen'));assert(!source.includes('<legend>FRAME DESIGN</legend>'));
for(const name of ['arrived-memories','minimal-film','music-player','summer'])assert(!designs[name]);
const render=source.slice(source.indexOf('async function renderDesignedCard()'),source.indexOf('async function renderCard()'));
(async()=>{for(const [key,d] of Object.entries(designs)){
 assert.equal(d.slots.length,3);const [x,y,w,h]=d.crop;for(const r of d.slots){assert(r.x>=x&&r.y>=y&&r.x+r.w<=x+w&&r.y+r.h<=y+h)}
 const photos=[],draws=[];const makeContext=()=>({fillRect(){},drawImage(img,...args){draws.push({img,args})},save(){},restore(){},beginPath(){},roundRect(){},clip(){},moveTo(){},lineTo(){},closePath(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}});
 const b={state:{template:key,shots:['third','first','second'],filter:'original'},cardDesigns:designs,loadImage:async src=>({src}),document:{createElement:()=>({getContext:makeContext})},cover:(ctx,img)=>photos.push(img.src)};vm.createContext(b);const canvas=await vm.runInContext(render+';renderDesignedCard()',b);assert.equal(canvas.width,600);assert.equal(canvas.height,1800);assert.deepEqual(photos,['third','first','second']);assert.deepEqual(draws[0].args.slice(0,4),d.crop);console.log(key+': three slots, artwork crop and reordered photo rendering passed');
}})().catch(e=>{console.error(e);process.exit(1)});
