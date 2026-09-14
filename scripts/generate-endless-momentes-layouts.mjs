import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('templates/endless-momentes');
fs.mkdirSync(outputDir, { recursive: true });

const layouts = {
  B:{w:600,h:1800,slots:[[44,70,512,320],[44,420,512,320],[44,770,512,320],[44,1120,512,320]]},
  C:{w:1200,h:1800,slots:[[55,70,535,545],[610,70,535,545],[55,640,535,545],[610,640,535,545]]},
  D:{w:1200,h:1800,slots:[[55,70,1090,1115]]},
  E:{w:1200,h:1800,slots:[[55,70,1090,545],[55,640,1090,545]]},
  F:{w:1800,h:1200,slots:[[70,65,1660,805]]},
  G:{w:1800,h:1200,slots:[[70,65,820,805],[910,65,820,805]]},
  H:{w:1800,h:1200,slots:[[70,65,1660,385],[70,475,540,395],[630,475,540,395],[1190,475,540,395]]},
  I:{w:1800,h:1200,slots:[[70,65,820,385],[70,475,820,395],[910,475,820,395]]},
  J:{w:1800,h:1200,slots:[[70,65,820,385],[910,65,820,385],[70,475,820,395]]},
  K:{w:1800,h:1200,slots:[[70,65,820,385],[70,475,820,395]],note:true},
};

function scallopedRect([x,y,w,h],i){
 const r=Math.max(12,Math.min(22,Math.min(w,h)*.045));
 return `<g id="photo-slot-${i+1}" data-photo-slot="${i+1}">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#fffdf3" stroke="#fffdf3" stroke-width="16" stroke-linecap="round" stroke-dasharray="2 ${r*1.65}"/>
  <rect x="${x+r*.65}" y="${y+r*.65}" width="${w-r*1.3}" height="${h-r*1.3}" rx="${r*.4}" fill="url(#blank)"/>
 </g>`;
}

const heart=(x,y,s,a=0)=>`<path d="M0 ${s*.22}C-${s*.48}-${s*.2}-${s*.58} ${s*.45} 0 ${s}C${s*.58} ${s*.45},${s*.48}-${s*.2},0 ${s*.22}Z" transform="translate(${x} ${y}) rotate(${a})" fill="url(#pink)" stroke="#ef9cb0" stroke-width="2"/>`;

function flower(x,y,s){
 return `<g transform="translate(${x} ${y})" fill="url(#pink)" stroke="#f5a6ba" stroke-width="2">
  <ellipse rx="${s*.19}" ry="${s*.48}" transform="rotate(0) translate(0 -${s*.28})"/><ellipse rx="${s*.19}" ry="${s*.48}" transform="rotate(72) translate(0 -${s*.28})"/><ellipse rx="${s*.19}" ry="${s*.48}" transform="rotate(144) translate(0 -${s*.28})"/><ellipse rx="${s*.19}" ry="${s*.48}" transform="rotate(216) translate(0 -${s*.28})"/><ellipse rx="${s*.19}" ry="${s*.48}" transform="rotate(288) translate(0 -${s*.28})"/><circle r="${s*.12}" fill="#ffd2dc"/>
 </g>`;
}

function lips(x,y,s,a=-8){return `<g transform="translate(${x} ${y}) rotate(${a})" fill="#d85672" stroke="#f39caf" stroke-width="2"><path d="M0 0Q${s*.25}-${s*.35} ${s*.5}-${s*.05}Q${s*.75}-${s*.35} ${s} 0Q${s*.5} ${s*.18} 0 0Z"/><path d="M0 0Q${s*.5} ${s*.5} ${s} 0Q${s*.5} ${s*.16} 0 0Z"/></g>`;}

function svg(letter,cfg){
 const {w,h,slots,note}=cfg, portrait=h>w;
 const footerTop=portrait?1405:900;
 const fsTitle=portrait?Math.min(70,w*.12):76;
 return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
 <title id="title">Endless Moments photocard — layout ${letter}</title>
 <desc id="desc">Editable burgundy romantic photo template with scalloped blank photo slots.</desc>
 <defs>
  <radialGradient id="burgundy"><stop stop-color="#861728"/><stop offset="1" stop-color="#5d0814"/></radialGradient>
  <linearGradient id="blank" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffef8"/><stop offset="1" stop-color="#f7f1df"/></linearGradient>
  <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff9cb8"/><stop offset=".55" stop-color="#c9325c"/><stop offset="1" stop-color="#8f1737"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="3" seed="11"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="soft-light"/></filter>
  <filter id="glow"><feGaussianBlur stdDeviation="12"/></filter>
 </defs>
 <rect width="${w}" height="${h}" fill="url(#burgundy)"/>
 <ellipse cx="${w*.25}" cy="${h*.25}" rx="${w*.34}" ry="${h*.42}" fill="#b72a3b" opacity=".15" filter="url(#glow)"/>
 <rect width="${w}" height="${h}" fill="#7b1421" opacity=".13" filter="url(#grain)"/>
 <g id="photo-slots">${slots.map(scallopedRect).join('')}</g>
 ${note?`<g id="message-area" fill="#fff5ed"><text x="1320" y="300" text-anchor="middle" font-family="'Segoe Script','Brush Script MT',cursive" font-size="72">Endless words</text><path d="M1060 360H1580M1060 450H1580M1060 540H1580M1060 630H1580" stroke="#efb5be" stroke-width="3" opacity=".8"/></g>`:''}
 ${flower(portrait?75:100,portrait?90:110,portrait?65:80)}
 ${heart(portrait?38:80,portrait?710:520,portrait?48:58,-10)}
 ${lips(portrait?18:80,portrait?1320:835,portrait?95:115,-8)}
 <g id="footer" fill="#fff8ed">
  <text x="${w/2}" y="${footerTop+150}" text-anchor="middle" font-family="'Segoe Script','Edwardian Script ITC','Brush Script MT',cursive" font-size="${fsTitle}" font-style="italic">Endless Moments</text>
  <path d="M${w*.25} ${footerTop+215}Q${w*.42} ${footerTop+245} ${w*.5} ${footerTop+212}Q${w*.58} ${footerTop+180} ${w*.75} ${footerTop+215}" fill="none" stroke="#fff8ed" stroke-width="5" stroke-linecap="round"/>
  <path d="M${w*.46} ${footerTop+210}q${w*.055}-${portrait?45:30} ${w*.085} 0q-${w*.045} ${portrait?48:34}-${w*.1} ${portrait?12:8}" fill="none" stroke="#fff8ed" stroke-width="5" stroke-linecap="round"/>
 </g>
</svg>`;
}

for(const [letter,cfg] of Object.entries(layouts)){
 fs.writeFileSync(path.join(outputDir,`endless-moments-layout-${letter}.svg`),svg(letter,cfg),'utf8');
}
console.log(`Generated ${Object.keys(layouts).length} SVG layouts in ${outputDir}`);
