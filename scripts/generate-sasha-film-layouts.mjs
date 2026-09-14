import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('templates/sasha-film');
fs.mkdirSync(outputDir, { recursive: true });

const layouts = {
  B:{w:600,h:1800,slots:[[82,50,436,330],[82,400,436,330],[82,750,436,330],[82,1100,436,330]]},
  C:{w:1200,h:1800,slots:[[105,55,485,555],[610,55,485,555],[105,630,485,555],[610,630,485,555]]},
  D:{w:1200,h:1800,slots:[[105,55,990,1130]]},
  E:{w:1200,h:1800,slots:[[105,55,990,555],[105,630,990,555]]},
  F:{w:1800,h:1200,slots:[[115,55,1570,800]]},
  G:{w:1800,h:1200,slots:[[115,55,775,800],[910,55,775,800]]},
  H:{w:1800,h:1200,slots:[[115,55,1570,380],[115,455,510,400],[645,455,510,400],[1175,455,510,400]]},
  I:{w:1800,h:1200,slots:[[115,55,775,380],[115,455,775,400],[910,455,775,400]]},
  J:{w:1800,h:1200,slots:[[115,55,775,380],[910,55,775,380],[115,455,775,400]]},
  K:{w:1800,h:1200,slots:[[115,55,775,380],[115,455,775,400]],note:true},
};

function slot([x,y,w,h],i){return `<g id="photo-slot-${i+1}" data-photo-slot="${i+1}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(34,Math.max(14,w*.035))}" fill="url(#blank)" stroke="#242424" stroke-width="3"/></g>`;}

function sprockets(w,h,portrait){
 const rail=portrait?34:44, holeW=portrait?23:29, holeH=13, gap=37;
 let out='';
 for(let y=75;y<h-70;y+=gap){
  out+=`<rect x="${rail-holeW/2}" y="${y}" width="${holeW}" height="${holeH}" rx="1" fill="#fff"/><rect x="${w-rail-holeW/2}" y="${y}" width="${holeW}" height="${holeH}" rx="1" fill="#fff"/>`;
 }
 return out;
}

function markers(w,h,portrait){
 const x1=portrait?34:44,x2=w-x1;
 let out='';
 for(let y=45;y<h-100;y+=270){
  out+=`<path d="M${x1-13} ${y+12}h26l-13-25Z" fill="#fff"/><path d="M${x2-13} ${y+12}h26l-13-25Z" fill="#fff"/>`;
 }
 return out;
}

function svg(letter,cfg){
 const {w,h,slots,note}=cfg,portrait=h>w,footerTop=portrait?1430:900;
 const nameSize=portrait?Math.min(68,w*.115):78;
 return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
 <title id="title">Sasha 28 film-strip photocard — layout ${letter}</title>
 <desc id="desc">Editable black film-negative template with blank charcoal photo slots.</desc>
 <defs>
  <linearGradient id="blank" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#343434"/><stop offset=".52" stop-color="#202020"/><stop offset="1" stop-color="#3a3a3a"/></linearGradient>
  <linearGradient id="film" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#030303"/><stop offset=".5" stop-color="#000"/><stop offset="1" stop-color="#080808"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="16"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="screen"/></filter>
 </defs>
 <rect width="${w}" height="${h}" fill="url(#film)"/>
 <rect width="${w}" height="${h}" fill="#fff" opacity=".025" filter="url(#grain)"/>
 <g id="film-sprockets">${sprockets(w,h,portrait)}${markers(w,h,portrait)}</g>
 <g id="photo-slots">${slots.map(slot).join('')}</g>
 ${note?`<g id="message-area" fill="#fff"><text x="1300" y="275" text-anchor="middle" font-family="Georgia,serif" font-size="72" letter-spacing="6">YOUR STORY</text><path d="M1080 345H1540M1080 445H1540M1080 545H1540M1080 645H1540" stroke="#fff" stroke-width="3" opacity=".7"/></g>`:''}
 <g id="footer" fill="#fff">
  <text x="${w*.43}" y="${footerTop+85}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${nameSize}" letter-spacing="5">SASHA</text>
  <text x="${w*.57}" y="${footerTop+175}" text-anchor="middle" font-family="'Segoe Script','Brush Script MT',cursive" font-size="${nameSize*1.65}" font-style="italic">28</text>
  <path d="M${w*.24} ${footerTop+235}H${w*.46}" stroke="#fff" stroke-width="4"/>
  <text x="${w*.72}" y="${footerTop+250}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${nameSize*.58}">01.01.25</text>
 </g>
</svg>`;
}

for(const [letter,cfg] of Object.entries(layouts)){
 fs.writeFileSync(path.join(outputDir,`sasha-film-layout-${letter}.svg`),svg(letter,cfg),'utf8');
}
console.log(`Generated ${Object.keys(layouts).length} SVG layouts in ${outputDir}`);
