import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('templates/movie-time');
fs.mkdirSync(outputDir, { recursive: true });

const layouts = {
  B:{w:600,h:1800,slots:[[52,285,496,270],[52,575,496,270],[52,865,496,270],[52,1155,496,270]]},
  C:{w:1200,h:1800,slots:[[65,285,525,455],[610,285,525,455],[65,760,525,455],[610,760,525,455]]},
  D:{w:1200,h:1800,slots:[[65,285,1070,930]]},
  E:{w:1200,h:1800,slots:[[65,285,1070,455],[65,760,1070,455]]},
  F:{w:1800,h:1200,slots:[[70,255,1660,610]]},
  G:{w:1800,h:1200,slots:[[70,255,820,610],[910,255,820,610]]},
  H:{w:1800,h:1200,slots:[[70,255,1660,290],[70,565,540,300],[630,565,540,300],[1190,565,540,300]]},
  I:{w:1800,h:1200,slots:[[70,255,820,290],[70,565,820,300],[910,565,820,300]]},
  J:{w:1800,h:1200,slots:[[70,255,820,290],[910,255,820,290],[70,565,820,300]]},
  K:{w:1800,h:1200,slots:[[70,255,820,290],[70,565,820,300]],note:true},
};

function photo([x,y,w,h],i){
 const horizon=y+h*.7;
 return `<g id="photo-slot-${i+1}" data-photo-slot="${i+1}">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>
  <ellipse cx="${x+w*.2}" cy="${y+h*.25}" rx="${w*.085}" ry="${h*.055}" fill="#fff" opacity=".95"/>
  <ellipse cx="${x+w*.27}" cy="${y+h*.245}" rx="${w*.07}" ry="${h*.075}" fill="#fff" opacity=".95"/>
  <ellipse cx="${x+w*.34}" cy="${y+h*.26}" rx="${w*.08}" ry="${h*.05}" fill="#fff" opacity=".95"/>
  <path d="M${x} ${horizon}Q${x+w*.18} ${y+h*.5} ${x+w*.42} ${y+h*.68}T${x+w} ${y+h*.62}V${y+h}H${x}Z" fill="#b7db4d"/>
  <path d="M${x} ${y+h*.78}Q${x+w*.2} ${y+h*.58} ${x+w*.45} ${y+h*.77}T${x+w} ${y+h*.7}V${y+h}H${x}Z" fill="#79a900"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#f8f0df" stroke-width="6"/>
 </g>`;
}

function camera(x,y,s){return `<g transform="translate(${x} ${y}) scale(${s})" fill="#242424" stroke="#0f0f0f" stroke-width="3"><circle cx="28" cy="25" r="24"/><circle cx="78" cy="25" r="27"/><circle cx="28" cy="25" r="9" fill="#555"/><circle cx="78" cy="25" r="10" fill="#555"/><rect x="25" y="50" width="66" height="34" rx="5"/><path d="M91 58l35-16v47L91 75Z"/><rect x="45" y="82" width="48" height="13" transform="rotate(-8 45 82)"/></g>`;}

function reel(x,y,s){return `<g transform="translate(${x} ${y}) scale(${s})"><circle r="48" fill="#a9aaac" stroke="#555" stroke-width="4"/><circle r="9" fill="#333"/>${[0,72,144,216,288].map(a=>`<ellipse rx="10" ry="21" cy="-27" transform="rotate(${a})" fill="#353535"/>`).join('')}<path d="M-35 38l-32 28h100l-18-24" fill="#e8dfcf" stroke="#4b4b4b" stroke-width="4"/></g>`;}

function barcode(x,y,w,h){
 const pattern=[3,1,2,1,4,2,1,3,2,1,1,4,2,3,1,1,3,2,4,1,2,2,1,4,3,1,2,1,3,2,1,4,1,2,3,1];
 const unit=w/pattern.reduce((a,b)=>a+b,0); let pos=x, bars='';
 pattern.forEach((n,i)=>{const bw=n*unit;if(i%2===0)bars+=`<rect x="${pos.toFixed(2)}" y="${y}" width="${bw.toFixed(2)}" height="${h}"/>`;pos+=bw;});return bars;
}

function svg(letter,cfg){
 const {w,h,slots,note}=cfg,portrait=h>w,footerY=portrait?1485:925;
 const titleSize=portrait?Math.min(86,w*.145):96;
 return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
 <title id="title">Movie Time ticket photocard — layout ${letter}</title>
 <desc id="desc">Editable movie-ticket template with illustrated empty photo placeholders.</desc>
 <defs>
  <linearGradient id="ticket" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fdf6e8"/><stop offset="1" stop-color="#eee0c8"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a9e2ff"/><stop offset="1" stop-color="#e7f8ff"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="19"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
 </defs>
 <rect width="${w}" height="${h}" fill="#760509"/>
 <rect x="${portrait?28:34}" y="${portrait?28:32}" width="${w-(portrait?56:68)}" height="${h-(portrait?56:64)}" rx="18" fill="url(#ticket)"/>
 <rect x="${portrait?28:34}" y="${portrait?28:32}" width="${w-(portrait?56:68)}" height="${h-(portrait?56:64)}" rx="18" fill="#fff" opacity=".08" filter="url(#grain)"/>
 <path d="M${portrait?45:55} 30H${w-(portrait?45:55)}" stroke="#760509" stroke-width="25" stroke-linecap="round" stroke-dasharray="1 ${portrait?28:36}"/>
 <path d="M${portrait?45:55} ${h-30}H${w-(portrait?45:55)}" stroke="#760509" stroke-width="25" stroke-linecap="round" stroke-dasharray="1 ${portrait?28:36}"/>
 <text x="${w/2}" y="${portrait?105:105}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${titleSize}" fill="#72080c" letter-spacing="2">MOVIE</text>
 <text x="${w/2}" y="${portrait?195:195}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${titleSize}" fill="#72080c" letter-spacing="2">TIME</text>
 ${camera(portrait?42:95,portrait?130:120,portrait?.72:.86)}${reel(w-(portrait?95:120),portrait?155:155,portrait?.68:.8)}
 <g id="photo-slots">${slots.map(photo).join('')}</g>
 ${note?`<g id="caption-area" fill="#72080c"><text x="1320" y="475" text-anchor="middle" font-family="Georgia,serif" font-size="68">Now Showing</text><path d="M1080 540H1560M1080 630H1560M1080 720H1560" stroke="#72080c" stroke-width="3" opacity=".55"/></g>`:''}
 <g id="footer" fill="#111">
  <path d="M${portrait?65:80} ${footerY-42}H${w-(portrait?65:80)}" stroke="#7c1015" stroke-width="18" stroke-linecap="round" stroke-dasharray="1 ${portrait?33:42}"/>
  ${barcode(portrait?90:120,footerY,portrait?w-180:w-240,portrait?130:120)}
  <text x="${w/2}" y="${footerY+(portrait?175:162)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${portrait?36:42}" letter-spacing="9">0 123456 789111</text>
 </g>
</svg>`;
}

for(const [letter,cfg] of Object.entries(layouts)){
 fs.writeFileSync(path.join(outputDir,`movie-time-layout-${letter}.svg`),svg(letter,cfg),'utf8');
}
console.log(`Generated ${Object.keys(layouts).length} SVG layouts in ${outputDir}`);
