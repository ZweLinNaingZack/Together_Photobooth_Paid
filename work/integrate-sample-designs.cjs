const fs=require('fs'),path=require('path'),vm=require('vm');
const root='C:/Users/Zwe Lin Naing/Documents/Codex/2026-09-09/build-x20/outputs/together';
const source=path.resolve('sample-photocard-desgin-all');
const measured=JSON.parse(fs.readFileSync('work/design-geometry.json','utf8'));
const defs={};const radii={B:32,C:32,D:45,E:40,G:40,H:30,K:32};
for(const [key,d] of Object.entries(measured)){
 const filename=`arrived-memories-layout-${key}.png`;
 if(!fs.existsSync(path.join(source,filename)))throw Error('Missing '+filename);
 defs[key]={src:`public/${filename}`,width:d.size[0],height:d.size[1],radius:radii[key],slots:d.boxes.map(([x,y,x1,y1])=>({x,y,w:x1-x,h:y1-y}))};
}
let flow=fs.readFileSync(path.join(root,'booth-flow.js'),'utf8');
if(flow.includes('const sampleDesigns='))throw Error('Already integrated; inspect before applying again');
flow=flow.replace('const {layouts,filters,move,captureTargets,replaceShot,filterPixels}=BoothCore;','const {layouts,filters,move,captureTargets,replaceShot,filterPixels}=BoothCore;\n  const sampleDesigns='+JSON.stringify(defs)+';');
flow=flow.replace('function miniature(l){return', 'function miniature(l){if(sampleDesigns[l.id])return `<img class="sample-layout-thumb" src="${sampleDesigns[l.id].src}" alt="Arrived Memories sample design for ${l.name}">`;return');
flow=flow.replace("state.retake=null;showStep('session')}}", "state.design=sampleDesigns[state.layout]?'arrived':'classic';state.retake=null;showStep('session')}}");
flow=flow.replace("[['classic','Classic'],['outline','Double border'],['hearts','Little hearts']]", "[...(sampleDesigns[state.layout]?[['arrived','Arrived Memories']]:[]),['classic','Classic'],['outline','Double border'],['hearts','Little hearts']]");
flow=flow.replace("state.design=r.value;updatePreview()", "state.design=r.value;editorScreen()");
flow=flow.replace("$('#back-session').onclick=()=>showStep('session');", "if(state.design==='arrived'){screen.querySelectorAll('[data-color]').forEach(b=>b.disabled=true);$('#card-caption').disabled=true;screen.querySelector('.finish-controls .session-note').textContent='Arrived Memories uses the colors, lettering and date in your supplied artwork. Choose Classic to customize colors and a caption. Filters still apply to your photos.'}$('#back-session').onclick=()=>showStep('session');");
flow=flow.replace('async function renderCard(){const snapshot=',"async function renderCard(){if(state.design==='arrived'&&sampleDesigns[state.layout])return renderSampleCard();const snapshot=");
const helper=`
  async function renderSampleCard(){
    const snapshot={...state,shots:[...state.shots]},l=layouts[snapshot.layout],design=sampleDesigns[snapshot.layout];
    if(design.slots.length!==l.count||snapshot.shots.filter(Boolean).length!==l.count)throw Error('Incomplete photocard');
    const [art,...images]=await Promise.all([loadImage(design.src),...snapshot.shots.map(loadImage)]);
    const canvas=document.createElement('canvas');canvas.width=l.width;canvas.height=l.height;const ctx=canvas.getContext('2d');
    const scale=Math.min(l.width/design.width,l.height/design.height),left=(l.width-design.width*scale)/2,top=(l.height-design.height*scale)/2;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,l.width,l.height);ctx.drawImage(art,left,top,design.width*scale,design.height*scale);
    images.forEach((img,i)=>{const slot=design.slots[i],w=Math.round(slot.w*scale),h=Math.round(slot.h*scale),photo=document.createElement('canvas');photo.width=w;photo.height=h;
      const pc=photo.getContext('2d',{willReadFrequently:true});cover(pc,img,0,0,w,h);
      if(snapshot.filter!=='original'){const pixels=pc.getImageData(0,0,w,h);filterPixels(pixels.data,snapshot.filter,17+i);pc.putImageData(pixels,0,0)}
      const x=left+slot.x*scale,y=top+slot.y*scale;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,design.radius*scale);ctx.clip();ctx.drawImage(photo,x,y,w,h);ctx.restore();
    });return canvas;
  }
`;
flow=flow.replace('  async function renderCard()',helper+'  async function renderCard()');
new vm.Script(flow);
fs.mkdirSync('work/sample-integration',{recursive:true});
fs.writeFileSync('work/sample-integration/booth-flow.js',flow);
let css=fs.readFileSync(path.join(root,'booth-flow.css'),'utf8');css+='\n.sample-layout-thumb{height:150px;max-width:100%;object-fit:contain;filter:drop-shadow(2px 5px 5px #25282320)}.finish-controls input:disabled{opacity:.55;cursor:not-allowed}.finish-controls .swatch:disabled{cursor:not-allowed;opacity:.4}\n';
fs.writeFileSync('work/sample-integration/booth-flow.css',css);
let server=fs.readFileSync(path.join(root,'server.mjs'),'utf8');server=server.replace("'.jpg':'image/jpeg'","'.jpg':'image/jpeg','.png':'image/png'");fs.writeFileSync('work/sample-integration/server.mjs',server);
fs.writeFileSync('work/sample-integration/designs.json',JSON.stringify(defs,null,2));
console.log('Prepared seven sample designs and integration. No website files changed yet.');
