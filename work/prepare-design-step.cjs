const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const root='C:/Users/Zwe Lin Naing/Documents/Codex/2026-09-09/build-x20/outputs/together';
const git='C:/Users/Zwe Lin Naing/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const out='work/design-step';fs.mkdirSync(out,{recursive:true});
const box=(x,y,w,h,r=0)=>({x,y,w,h,r});
const designs={
 'breaking-news':{name:'Breaking News',size:[799,1969],crop:[0,0,799,1969],slots:[box(64,570,671,384),box(64,994,671,380),box(64,1413,671,382)]},
 'catch-yours':{name:'Catch Yours',size:[1030,1526],crop:[0,0,514,1526],slots:[{...box(62,246,373,276),poly:[[62,261],[424,246],[435,506],[71,522]]},{...box(64,598,381,287),poly:[[85,598],[445,628],[424,885],[64,858]]},{...box(63,960,366,265),poly:[[68,960],[429,966],[425,1225],[63,1220]]}]},
 'clapper-filmstrip':{name:'Clapper Filmstrip',size:[1090,1443],crop:[53,33,446,1329],slots:[box(115,338,325,327),box(115,674,325,326),box(115,1009,325,329)]},
 'endless-moments':{name:'Endless Moments',size:[1024,1536],crop:[228,12,568,1512],slots:[box(272,97,481,364),box(272,501,481,363),box(272,903,481,360)],mask:'cream'},
 'film-negative':{name:'Film Negative',size:[1024,1536],crop:[248,20,528,1494],slots:[box(314,41,396,395,21),box(314,454,396,388,21),box(314,860,396,379,21)]},
 'movie-time':{name:'Movie Time',size:[1085,1449],crop:[303,12,480,1397],slots:[box(346,226,397,286),box(346,520,397,278),box(346,807,397,280)]},
 'nutrition-label':{name:'Nutrition Label',size:[946,1663],crop:[217,11,512,1641],slots:[box(250,356,446,281),box(250,655,446,281),box(250,953,446,281)]},
 'red-music-player':{name:'Red Music Player',size:[1123,1401],crop:[300,9,524,1382],slots:[box(345,53,435,284,28),box(345,354,435,284,28),box(345,655,435,284,28)]},
 'story-today':{name:'Story Today',size:[1063,1479],crop:[246,4,570,1471],slots:[box(273,272,517,282),box(273,569,517,282),box(273,864,517,274)]},
 'ticket-memories':{name:'Ticket Memories',size:[957,1644],crop:[24,7,437,1472],slots:[box(64,318,356,271),box(64,602,356,270),box(64,886,356,268)]}
};
for(const [key,d] of Object.entries(designs)){d.src=`public/a-${key}.png`;if(!fs.existsSync(`templates/regenerated/${key}.png`))throw Error(key)}
let flow=cp.execFileSync(git,['-c','safe.directory='+root,'show','HEAD:booth-flow.js'],{cwd:root,encoding:'utf8'});
flow=flow.replace('const {layouts,filters,move,captureTargets,replaceShot,filterPixels}=BoothCore;','const {layouts,filters,move,captureTargets,replaceShot,filterPixels}=BoothCore;\n  const cardDesigns='+JSON.stringify(designs)+';');
flow=flow.replace("design:'classic'","design:'classic',template:null");
flow=flow.replace('session:sessionScreen,edit:editorScreen','design:designScreen,session:sessionScreen,edit:editorScreen');
flow=flow.replace('Object.entries(layouts).map','Object.entries(layouts).filter(([key])=>!["F","I","J"].includes(key)).map').replace('Eleven ways','Eight ways');
flow=flow.replace('Into the booth <span','Choose a design <span');
flow=flow.replace("state.shots=[];state.layout=chosen","state.shots=[];state.template=null;state.layout=chosen");
flow=flow.replace("state.retake=null;showStep('session')}}","state.retake=null;showStep('design')}}");
const gallery=`
  function designScreen(){const isA=state.layout==='A';
    screen.innerHTML=heading('NEXT, A LITTLE PERSONALITY','A design that feels <em>like you.</em>',isA?'Layout A · 3 photos · Choose your photocard before the camera starts.':'More designs for this layout are coming later. You can use the classic frame today.')+
    '<fieldset class="card-design-gallery"><legend class="sr-only">Choose photocard design</legend>'+ (isA?Object.entries(cardDesigns).map(([key,d])=>{const [x,y,w,h]=d.crop;return \`<label class="card-design-option"><input type="radio" name="card-template" value="\${key}" \${state.template===key?'checked':''}><span class="card-design-face"><span class="card-art-window" style="aspect-ratio:\${w}/\${h}"><img src="\${d.src}" alt="\${d.name} three-photo design" loading="lazy" style="width:\${d.size[0]/w*100}%;height:\${d.size[1]/h*100}%;left:\${-x/w*100}%;top:\${-y/h*100}%"></span><strong>\${d.name}</strong><small>3 photos</small></span></label>\`}).join(''):'')+
    \`<label class="card-design-option"><input type="radio" name="card-template" value="classic" \${!state.template?'checked':''}><span class="card-design-face"><span class="plain-design-thumb">\${miniature(layouts[state.layout])}</span><strong>Classic</strong><small>Your colors, your caption</small></span></label></fieldset><div class="step-actions"><button class="text-button" id="back-layout">← Change layout</button><button class="primary" id="design-continue">Take the photos now ↗</button></div>\`;
    screen.querySelectorAll('[name=card-template]').forEach(r=>r.onchange=()=>{state.template=r.value==='classic'?null:r.value});
    $('#back-layout').onclick=()=>showStep('layout');$('#design-continue').onclick=()=>showStep('session');
  }
`;
flow=flow.replace('  function photoTray()',gallery+'  function photoTray()');
flow=flow.replace('← Change layout</button>${state.retake','← Change design</button>${state.retake');
flow=flow.replace("$('#change-layout').onclick=()=>{stopCamera();showStep('layout')}","$('#change-layout').onclick=()=>{stopCamera();showStep('design')}");
flow=flow.replace('FINALLY, MAKE IT YOURS','YOUR FINISHED MOMENTS').replace('A little keepsake. <em>All you.</em>','Your photos. <em>Your keepsake.</em>');
const fieldStart=flow.indexOf('<fieldset><legend>FRAME DESIGN</legend>');const fieldEnd=flow.indexOf('<fieldset><legend>FRAME COLOR</legend>',fieldStart);
if(fieldStart<0||fieldEnd<0)throw Error('Cannot locate frame options');flow=flow.slice(0,fieldStart)+'<div class="chosen-design-note"><strong>${state.template?cardDesigns[state.template].name:"Classic"}</strong><button class="text-button" id="review-change-design">Change design</button></div>'+flow.slice(fieldEnd);
flow=flow.replace("$('#back-session').onclick=()=>showStep('session');", "$('#review-change-design').onclick=()=>showStep('design');if(state.template){screen.querySelectorAll('[data-color]').forEach(b=>b.closest('fieldset').hidden=true);$('#card-caption').hidden=true;screen.querySelector('label[for=card-caption]').hidden=true;screen.querySelector('.finish-controls .session-note').textContent='Your selected design is ready. Filters apply only to your photos; the printed artwork stays unchanged.'}$('#back-session').onclick=()=>showStep('session');");
flow=flow.replace('async function renderCard(){const snapshot=',"async function renderCard(){if(state.template&&state.layout==='A')return renderDesignedCard();const snapshot=");
const render=`
  async function renderDesignedCard(){
    const snapshot={...state,shots:[...state.shots]},d=cardDesigns[snapshot.template];if(snapshot.shots.length!==3)throw Error('Three photos required');
    const [art,...images]=await Promise.all([loadImage(d.src),...snapshot.shots.map(loadImage)]);
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=1800;const ctx=canvas.getContext('2d');
    const [cx,cy,cw,ch]=d.crop,scale=Math.min(600/cw,1800/ch),ox=(600-cw*scale)/2,oy=(1800-ch*scale)/2;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,600,1800);ctx.drawImage(art,cx,cy,cw,ch,ox,oy,cw*scale,ch*scale);
    images.forEach((img,i)=>{const r=d.slots[i],w=Math.round(r.w*scale),h=Math.round(r.h*scale),photo=document.createElement('canvas');photo.width=w;photo.height=h;const pc=photo.getContext('2d',{willReadFrequently:true});cover(pc,img,0,0,w,h);
      if(snapshot.filter!=='original'){const pixels=pc.getImageData(0,0,w,h);filterPixels(pixels.data,snapshot.filter,17+i);pc.putImageData(pixels,0,0)}
      if(d.mask==='cream'){const mask=document.createElement('canvas');mask.width=w;mask.height=h;const mc=mask.getContext('2d',{willReadFrequently:true});mc.drawImage(art,r.x,r.y,r.w,r.h,0,0,w,h);const mp=mc.getImageData(0,0,w,h);for(let p=0;p<mp.data.length;p+=4)mp.data[p+3]=(mp.data[p]>215&&mp.data[p+1]>205&&mp.data[p+2]>175)?255:0;mc.putImageData(mp,0,0);pc.globalCompositeOperation='destination-in';pc.drawImage(mask,0,0)}
      const x=ox+(r.x-cx)*scale,y=oy+(r.y-cy)*scale;ctx.save();ctx.beginPath();if(r.poly){r.poly.forEach(([px,py],n)=>{const dx=ox+(px-cx)*scale,dy=oy+(py-cy)*scale;n?ctx.lineTo(dx,dy):ctx.moveTo(dx,dy)});ctx.closePath()}else ctx.roundRect(x,y,w,h,(r.r||0)*scale);ctx.clip();ctx.drawImage(photo,x,y,w,h);ctx.restore();
    });return canvas;
  }
`;
flow=flow.replace('  async function renderCard()',render+'  async function renderCard()');new vm.Script(flow);fs.writeFileSync(out+'/booth-flow.js',flow);fs.writeFileSync(out+'/designs.json',JSON.stringify(designs));
let html=fs.readFileSync(root+'/index.html','utf8');html=html.replace('<li data-step="session">02 <span>Your moment</span></li><li data-step="edit">03 <span>Your keepsake</span></li>','<li data-step="design">02 <span>Your design</span></li><li data-step="session">03 <span>Your moment</span></li><li data-step="edit">04 <span>Review & export</span></li>');
html=html.replace('Each layout sets the number of photos.','Each layout sets the number of photos. Next, pick a design on its own page before starting the camera.').replace('Then choose a frame, color, and filter before downloading or printing.','Add a filter if you like, then download or print your chosen photocard.');fs.writeFileSync(out+'/index.html',html);
let css=cp.execFileSync(git,['-c','safe.directory='+root,'show','HEAD:booth-flow.css'],{cwd:root,encoding:'utf8'});css+=`
.card-design-gallery{border:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;padding:0;margin:0 auto 30px;max-width:1100px}.card-design-option{position:relative;cursor:pointer}.card-design-option>input{position:absolute;opacity:0;width:1px;height:1px}.card-design-face{height:365px;display:flex;align-items:center;flex-direction:column;padding:20px 10px;background:#e9ecdf;border:1px solid var(--line);border-radius:9px;transition:transform .2s}.card-design-option:hover .card-design-face{transform:translateY(-4px)}.card-design-option input:checked+.card-design-face{outline:2px solid var(--red);outline-offset:2px;background:#eee4df}.card-design-option input:focus-visible+.card-design-face{outline:3px solid #576f92;outline-offset:4px}.card-art-window{height:270px;max-width:100%;position:relative;overflow:hidden;display:block;box-shadow:2px 6px 12px #0002}.card-art-window img{position:absolute;max-width:none;object-fit:fill}.card-design-face>strong{font-size:16px;margin-top:18px;text-align:center}.card-design-face>small{font-size:13px;color:var(--muted);margin-top:8px}.plain-design-thumb{height:270px;display:flex;align-items:center;justify-content:center}.chosen-design-note{display:flex;gap:20px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:25px}.chosen-design-note>strong{font:28px var(--serif)}.step-actions .text-button{margin-right:24px}
@media(max-width:850px){.card-design-gallery{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.flow-steps{gap:15px}.flow-steps li{font-size:12px}}
@media(max-width:600px){.card-design-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card-design-face{height:320px;padding:15px 6px}.card-art-window,.plain-design-thumb{height:230px}.card-design-face>strong{font-size:14px}.flow-steps{gap:9px;justify-content:space-between}.flow-steps li{flex-direction:column;gap:5px;font-size:11px;text-align:center}.step-actions .text-button{display:block;margin:0 auto 16px}}
`;fs.writeFileSync(out+'/booth-flow.css',css);console.log('Prepared ten three-photo designs and a dedicated design screen.');
