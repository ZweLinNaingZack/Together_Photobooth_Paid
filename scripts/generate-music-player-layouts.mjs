import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('templates/music-player');
fs.mkdirSync(outputDir, { recursive: true });

const layouts = {
  B:{w:600,h:1800,slots:[[48,110,504,270],[48,400,504,270],[48,690,504,270],[48,980,504,270]]},
  C:{w:1200,h:1800,slots:[[60,110,530,435],[610,110,530,435],[60,565,530,435],[610,565,530,435]]},
  D:{w:1200,h:1800,slots:[[60,110,1080,890]]},
  E:{w:1200,h:1800,slots:[[60,110,1080,435],[60,565,1080,435]]},
  F:{w:1800,h:1200,slots:[[70,100,1660,650]]},
  G:{w:1800,h:1200,slots:[[70,100,820,650],[910,100,820,650]]},
  H:{w:1800,h:1200,slots:[[70,100,1660,310],[70,430,540,320],[630,430,540,320],[1190,430,540,320]]},
  I:{w:1800,h:1200,slots:[[70,100,820,310],[70,430,820,320],[910,430,820,320]]},
  J:{w:1800,h:1200,slots:[[70,100,820,310],[910,100,820,310],[70,430,820,320]]},
  K:{w:1800,h:1200,slots:[[70,100,820,310],[70,430,820,320]],note:true},
};

function slot([x,y,w,h],i){return `<g id="photo-slot-${i+1}" data-photo-slot="${i+1}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#photoBlank)" stroke="#111314" stroke-width="4"/></g>`;}

function controls(w,h,portrait){
 const cy=portrait?h-150:h-105,cx=w/2,scale=portrait?1:1.1;
 return `<g id="player-controls" fill="#f8f8f8" stroke="#f8f8f8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M${cx-250*scale} ${cy-5}C${cx-275*scale} ${cy-34},${cx-310*scale} ${cy-3},${cx-250*scale} ${cy+48}C${cx-190*scale} ${cy-3},${cx-225*scale} ${cy-34},${cx-250*scale} ${cy-5}Z" fill="none" stroke-width="4"/>
  <path d="M${cx-120*scale} ${cy-28}v56M${cx-115*scale} ${cy}l48-34v68Z" stroke-width="5"/>
  <circle cx="${cx}" cy="${cy}" r="49" fill="#fff"/><rect x="${cx-16}" y="${cy-22}" width="10" height="44" rx="4" fill="#101112" stroke="none"/><rect x="${cx+7}" y="${cy-22}" width="10" height="44" rx="4" fill="#101112" stroke="none"/>
  <path d="M${cx+115*scale} ${cy-28}v56M${cx+110*scale} ${cy}l-48-34v68Z" stroke-width="5"/>
  <circle cx="${cx+250*scale}" cy="${cy}" r="22" fill="none" stroke-width="3"/><path d="M${cx+242*scale} ${cy-8}l18 8-18 8Z"/>
 </g>`;
}

function svg(letter,cfg){
 const {w,h,slots,note}=cfg,portrait=h>w;
 const infoY=portrait?1305:790, left=portrait?50:75, right=w-left;
 const titleSize=portrait?42:48;
 return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
 <title id="title">Music Player photocard — layout ${letter}</title>
 <desc id="desc">Editable dark music-player photo template with blank image slots and playback controls.</desc>
 <defs>
  <linearGradient id="shell" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17191a"/><stop offset=".48" stop-color="#090a0a"/><stop offset="1" stop-color="#1b1d1e"/></linearGradient>
  <linearGradient id="photoBlank" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#444647"/><stop offset=".5" stop-color="#292b2c"/><stop offset="1" stop-color="#484a4b"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="23"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="screen"/></filter>
 </defs>
 <rect width="${w}" height="${h}" fill="url(#shell)"/>
 <rect width="${w}" height="${h}" fill="#fff" opacity=".025" filter="url(#grain)"/>
 <g id="app-header" fill="#fff" stroke="#fff" stroke-width="3" stroke-linecap="round">
  <path d="M${left} 40l16 16 16-16" fill="none"/>
  <text x="${w/2}" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" stroke="none">Photo Booth</text>
  <circle cx="${right-30}" cy="50" r="4"/><circle cx="${right-15}" cy="50" r="4"/><circle cx="${right}" cy="50" r="4"/>
 </g>
 <g id="photo-slots">${slots.map(slot).join('')}</g>
 ${note?`<g id="caption-space"><text x="1320" y="325" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" fill="#f4f4f4" font-weight="700">Your lyrics here</text><path d="M1080 390H1570M1080 470H1570M1080 550H1570" stroke="#777" stroke-width="3"/></g>`:''}
 <g id="track-info" font-family="Arial,sans-serif">
  <text x="${left}" y="${infoY}" font-size="${titleSize}" font-weight="700" fill="#fff">Your Title Here</text>
  <text x="${left}" y="${infoY+48}" font-size="${titleSize*.7}" fill="#999">Your Subtitle Here</text>
  <rect x="${left}" y="${infoY+82}" width="${right-left}" height="5" rx="2.5" fill="#6d7072"/><rect x="${left}" y="${infoY+82}" width="${(right-left)*.15}" height="5" rx="2.5" fill="#fff"/><circle cx="${left+(right-left)*.15}" cy="${infoY+84.5}" r="8" fill="#fff"/>
  <text x="${left}" y="${infoY+122}" font-size="20" fill="#aaa">0:00</text><text x="${right}" y="${infoY+122}" text-anchor="end" font-size="20" fill="#aaa">3:30</text>
 </g>
 ${controls(w,h,portrait)}
 <g id="utility-icons" stroke="#eee" fill="none" stroke-width="3"><rect x="${left}" y="${h-62}" width="20" height="30" rx="3"/><rect x="${left+25}" y="${h-62}" width="20" height="30" rx="3"/><path d="M${right-45} ${h-60}h38M${right-45} ${h-47}h38M${right-45} ${h-34}h38"/></g>
</svg>`;
}

for(const [letter,cfg] of Object.entries(layouts)){
 fs.writeFileSync(path.join(outputDir,`music-player-layout-${letter}.svg`),svg(letter,cfg),'utf8');
}
console.log(`Generated ${Object.keys(layouts).length} SVG layouts in ${outputDir}`);
