const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root='C:/Users/Zwe Lin Naing/Documents/Codex/2026-09-09/build-x20/outputs/together/';
const coreBox={};vm.createContext(coreBox);vm.runInContext(fs.readFileSync(root+'booth-core.js','utf8'),coreBox);
const sampleDesigns=JSON.parse(fs.readFileSync('work/sample-integration/designs.json','utf8'));
const source=fs.readFileSync(root+'booth-flow.js','utf8');const renderer=source.slice(source.indexOf('async function renderSampleCard()'),source.indexOf('async function renderCard()'));
(async()=>{for(const [key,design] of Object.entries(sampleDesigns)){
 const layout=coreBox.BoothCore.layouts[key],clips=[],draws=[],photos=[];
 const state={layout:key,shots:Array.from({length:layout.count},(_,i)=>'photo-'+i),filter:'original'};
 const makeContext=()=>({fillRect(){},drawImage(img,...rect){draws.push({img,rect})},save(){},beginPath(){},roundRect(x,y,w,h,r){clips.push({x,y,w,h,r})},clip(){},restore(){}});
 const box={state,layouts:coreBox.BoothCore.layouts,sampleDesigns,loadImage:async src=>({src}),document:{createElement:()=>({width:0,height:0,getContext:makeContext})},cover:(ctx,img)=>photos.push(img.src),filterPixels:()=>{}};vm.createContext(box);const output=await vm.runInContext(renderer+';renderSampleCard()',box);
 assert.equal(clips.length,layout.count);assert.equal(output.width,layout.width);assert.equal(output.height,layout.height);assert.deepEqual(photos,state.shots);assert.equal(draws[0].img.src,design.src);
 for(const r of clips)assert(r.x>=0&&r.y>=0&&r.x+r.w<=output.width+1&&r.y+r.h<=output.height+1);
 console.log(`Layout ${key}: original artwork, ${clips.length} rounded photo slots, capture order and export bounds passed`);
}})().catch(e=>{console.error(e);process.exit(1)});
