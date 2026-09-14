import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('templates/catch-yours');
fs.mkdirSync(outputDir, { recursive: true });

const layouts = {
  B: { w: 600, h: 1800, slots: [[54, 330, 492, 245], [54, 595, 492, 245], [54, 860, 492, 245], [54, 1125, 492, 245]] },
  C: { w: 1200, h: 1800, slots: [[65, 330, 525, 430], [610, 330, 525, 430], [65, 780, 525, 430], [610, 780, 525, 430]] },
  D: { w: 1200, h: 1800, slots: [[65, 330, 1070, 880]] },
  E: { w: 1200, h: 1800, slots: [[65, 330, 1070, 430], [65, 780, 1070, 430]] },
  F: { w: 1800, h: 1200, slots: [[70, 285, 1660, 565]] },
  G: { w: 1800, h: 1200, slots: [[70, 285, 820, 565], [910, 285, 820, 565]] },
  H: { w: 1800, h: 1200, slots: [[70, 285, 1660, 265], [70, 570, 540, 280], [630, 570, 540, 280], [1190, 570, 540, 280]] },
  I: { w: 1800, h: 1200, slots: [[70, 285, 820, 265], [70, 570, 820, 280], [910, 570, 820, 280]] },
  J: { w: 1800, h: 1200, slots: [[70, 285, 820, 265], [910, 285, 820, 265], [70, 570, 820, 280]] },
  K: { w: 1800, h: 1200, slots: [[70, 285, 820, 265], [70, 570, 820, 280]], note: true },
};

const heart = (x, y, size, rotate = 0) => `<path d="M0 ${size*.25} C-${size*.55} -${size*.18},-${size*.52} ${size*.65},0 ${size} C${size*.52} ${size*.65},${size*.55} -${size*.18},0 ${size*.25}Z" transform="translate(${x} ${y}) rotate(${rotate})" fill="#b5343f" opacity=".88"/>`;

function polaroid([x,y,w,h], i) {
  const angle = i % 2 ? 1.2 : -1.1;
  const pad = Math.max(10, Math.min(22, w*.025));
  const caption = Math.max(30, Math.min(58, h*.15));
  return `<g id="photo-${i+1}" data-photo-slot="${i+1}" transform="rotate(${angle} ${x+w/2} ${y+h/2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fffefd" stroke="#d9d5ce" stroke-width="3" filter="url(#shadow)"/>
    <rect x="${x+pad}" y="${y+pad}" width="${w-pad*2}" height="${h-pad*2-caption}" rx="3" fill="url(#photoBlank)" stroke="#ddd5c6" stroke-width="2"/>
    ${i===1 ? `<text x="${x+pad}" y="${y+h-18}" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="${Math.max(20,Math.min(36,w*.055))}" fill="#181515">Chilling out</text>` : ''}
  </g>`;
}

function svg(letter, cfg) {
  const {w,h,slots,note} = cfg;
  const portrait = h>w;
  const titleSize = portrait ? Math.min(108,w*.18) : 92;
  const footerY = portrait ? 1435 : 925;
  const ticketX = portrait ? 48 : 1080;
  const ticketW = portrait ? w-96 : 650;
  const ticketH = portrait ? 285 : 220;
  const titleX = portrait ? w/2 : 260;
  const titleAnchor = portrait ? 'middle' : 'start';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
 <title id="title">Catch Yours photocard — layout ${letter}</title>
 <desc id="desc">Editable romantic photocard template with blank photo slots and ticket footer.</desc>
 <defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8f4e7"/><stop offset="1" stop-color="#ece6d8"/></linearGradient>
  <linearGradient id="photoBlank"><stop stop-color="#fffdf4"/><stop offset=".52" stop-color="#f5efde"/><stop offset="1" stop-color="#fffaf0"/></linearGradient>
  <linearGradient id="ticket" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd0d8"/><stop offset="1" stop-color="#f2b3c0"/></linearGradient>
  <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#5c352f" flood-opacity=".28"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="8"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
 </defs>
 <rect width="${w}" height="${h}" fill="#aa3b40"/>
 <rect x="${portrait?26:34}" y="${portrait?26:34}" width="${w-(portrait?52:68)}" height="${h-(portrait?52:68)}" fill="url(#paper)" opacity=".98"/>
 <rect x="${portrait?26:34}" y="${portrait?26:34}" width="${w-(portrait?52:68)}" height="${h-(portrait?52:68)}" fill="#f6f0e3" opacity=".10" filter="url(#grain)"/>
 <text x="${titleX}" y="${portrait?125:120}" text-anchor="${titleAnchor}" font-family="'Segoe Script','Brush Script MT',cursive" font-size="${titleSize}" font-weight="700" fill="#a92f39">Catch</text>
 <text x="${titleX}" y="${portrait?220:205}" text-anchor="${titleAnchor}" font-family="'Segoe Script','Brush Script MT',cursive" font-size="${titleSize}" font-weight="700" fill="#a92f39">Yours</text>
 ${heart(w-120,70,55,15)}${heart(55,160,48,-12)}
 <g id="photo-slots">${slots.map(polaroid).join('')}</g>
 ${heart(w-145,footerY-70,43,15)}${heart(w-78,footerY+105,36,-8)}
 ${note?`<text x="1320" y="510" text-anchor="middle" font-family="'Segoe Script',cursive" font-size="54" fill="#a92f39">Leave a little note</text><path d="M1080 555H1570" stroke="#c57b7f" stroke-width="3"/><path d="M1080 625H1570M1080 695H1570" stroke="#c57b7f" stroke-width="2" opacity=".55"/>`:''}
 <g id="ticket-footer" transform="translate(${ticketX} ${footerY}) rotate(-1)">
  <rect width="${ticketW}" height="${ticketH}" rx="12" fill="url(#ticket)" stroke="#c26978" stroke-width="3" filter="url(#shadow)"/>
  <rect x="15" y="15" width="${ticketW-30}" height="${ticketH-30}" rx="9" fill="none" stroke="#a95867" stroke-width="2" stroke-dasharray="12 8"/>
  <line x1="${ticketW*.68}" y1="15" x2="${ticketW*.68}" y2="${ticketH-15}" stroke="#a95867" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="${ticketW*.34}" y="${ticketH*.35}" text-anchor="middle" font-family="Georgia,serif" font-size="${portrait?43:36}" font-weight="900">PHOTO</text>
  <text x="${ticketW*.34}" y="${ticketH*.54}" text-anchor="middle" font-family="Georgia,serif" font-size="${portrait?43:36}" font-weight="900">TICKET</text>
  <text x="${ticketW*.84}" y="${ticketH*.42}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${portrait?30:25}" font-weight="700">DAY</text>
  <text x="${ticketW*.84}" y="${ticketH*.60}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${portrait?30:25}" font-weight="700">PASS</text>
  <text x="28" y="${ticketH-28}" font-family="Arial,sans-serif" font-size="13">No. 001044</text>
 </g>
 <text x="${portrait?w-80:950}" y="${portrait?footerY-115:1015}" text-anchor="end" font-family="Impact,'Arial Black',sans-serif" font-size="${portrait?32:34}" fill="#181515">PHOTO</text>
 <text x="${portrait?w-80:950}" y="${portrait?footerY-82:1050}" text-anchor="end" font-family="Impact,'Arial Black',sans-serif" font-size="${portrait?32:34}" fill="#181515">PLACE</text>
</svg>`;
}

for (const [letter,cfg] of Object.entries(layouts)) {
  fs.writeFileSync(path.join(outputDir,`catch-yours-layout-${letter}.svg`),svg(letter,cfg),'utf8');
}
console.log(`Generated ${Object.keys(layouts).length} SVG layouts in ${outputDir}`);
