import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('templates/photobox');
fs.mkdirSync(outputDir, { recursive: true });

const layouts = {
  B: { w: 600, h: 1800, slots: [[52, 520, 496, 240], [52, 780, 496, 240], [52, 1040, 496, 240], [52, 1300, 496, 240]] },
  C: { w: 1200, h: 1800, slots: [[64, 520, 526, 365], [610, 520, 526, 365], [64, 905, 526, 365], [610, 905, 526, 365]] },
  D: { w: 1200, h: 1800, slots: [[64, 520, 1072, 750]] },
  E: { w: 1200, h: 1800, slots: [[64, 520, 1072, 365], [64, 905, 1072, 365]] },
  F: { w: 1800, h: 1200, slots: [[70, 465, 1660, 420]] },
  G: { w: 1800, h: 1200, slots: [[70, 465, 820, 420], [910, 465, 820, 420]] },
  H: { w: 1800, h: 1200, slots: [[70, 465, 1660, 190], [70, 675, 540, 210], [630, 675, 540, 210], [1190, 675, 540, 210]] },
  I: { w: 1800, h: 1200, slots: [[70, 465, 820, 190], [70, 675, 820, 210], [910, 675, 820, 210]] },
  J: { w: 1800, h: 1200, slots: [[70, 465, 820, 190], [910, 465, 820, 190], [70, 675, 820, 210]] },
  K: { w: 1800, h: 1200, slots: [[70, 465, 820, 190], [70, 675, 820, 210]], note: true },
};

function slotMarkup(slots) {
  return slots.map(([x,y,w,h], index) => `
    <g id="photo-slot-${index + 1}" data-photo-slot="${index + 1}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#placeholder)" stroke="#c7c5c2" stroke-width="2"/>
    </g>`).join('');
}

function svg(letter, cfg) {
  const { w, h, slots, note } = cfg;
  const portrait = h > w;
  const margin = portrait ? 46 : 55;
  const titleY = portrait ? 68 : 48;
  const headlineSize = portrait ? Math.min(74, w * .105) : 92;
  const logoSize = portrait ? Math.min(112, w * .18) : 142;
  const footerY = portrait ? 1650 : 990;
  const footerSize = portrait ? Math.min(32, w * .05) : 44;
  const center = w / 2;
  const ruleRight = w - margin;
  const subtitle = portrait ? 'BY KAMERASPACE' : 'BY KAMERASPACE';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
  <title id="title">Photobox newspaper template — layout ${letter}</title>
  <desc id="desc">Editable vintage newspaper photocard template with empty photo slots.</desc>
  <defs>
    <filter id="paperTexture" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="12" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply"/>
    </filter>
    <linearGradient id="placeholder" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#dedede"/><stop offset=".5" stop-color="#f0f0f0"/><stop offset="1" stop-color="#d1d1d1"/>
    </linearGradient>
    <filter id="distress" x="-5%" y="-10%" width="110%" height="120%">
      <feTurbulence baseFrequency=".025" numOctaves="2" seed="7" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="1.4"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="#eee9df"/>
  <rect width="${w}" height="${h}" fill="#f7f3ea" opacity=".35" filter="url(#paperTexture)"/>
  <g fill="#171717" stroke="#171717">
    <path d="M${margin} ${titleY}H${ruleRight}M${margin} ${titleY+10}H${ruleRight}" stroke-width="5"/>
    <text x="${center}" y="${titleY+92}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-3">BREAKING NEWS</text>
    <path d="M${margin} ${titleY+116}H${ruleRight}" stroke-width="5"/>
    <text x="${margin}" y="${titleY+153}" font-family="Arial Narrow, Impact, sans-serif" font-size="18" font-weight="700">VOL. 11, NO. 5</text>
    <text x="${center}" y="${titleY+153}" text-anchor="middle" font-family="Arial Narrow, Impact, sans-serif" font-size="18" letter-spacing="1">★   REALLYCREATSITE.COM   ★</text>
    <text x="${ruleRight}" y="${titleY+153}" text-anchor="end" font-family="Arial Narrow, Impact, sans-serif" font-size="18" font-weight="700">10 APRIL 2026</text>
    <path d="M${margin} ${titleY+170}H${ruleRight}" stroke-width="5"/>
    <text x="${center}" y="${titleY+300}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${logoSize}" font-weight="900" letter-spacing="4" filter="url(#distress)">PHOTOBOX</text>
    <text x="${center}" y="${titleY+370}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${logoSize*.48}" font-weight="900">${subtitle}</text>
    <path d="M${margin} ${titleY+395}H${ruleRight}M${margin} ${titleY+405}H${ruleRight}" stroke-width="5"/>
  </g>
  <g id="photo-slots">${slotMarkup(slots)}</g>
  ${note ? `<g id="caption-space"><text x="1320" y="585" text-anchor="middle" font-family="Georgia, serif" font-size="48" font-style="italic" fill="#242424">Your story,</text><text x="1320" y="645" text-anchor="middle" font-family="Georgia, serif" font-size="48" font-style="italic" fill="#242424">your moment.</text><path d="M1110 690H1530" stroke="#242424" stroke-width="3"/></g>` : ''}
  <g id="footer" fill="#171717" stroke="#171717">
    <path d="M${margin} ${footerY}H${ruleRight}M${margin} ${footerY+70}H${ruleRight}M${margin} ${footerY+82}H${ruleRight}" stroke-width="5"/>
    <circle cx="${margin+35}" cy="${footerY+35}" r="22"/><circle cx="${ruleRight-35}" cy="${footerY+35}" r="22"/>
    <text x="${margin+35}" y="${footerY+44}" text-anchor="middle" font-family="Arial" font-size="25" fill="#f7f3ea" stroke="none">★</text>
    <text x="${ruleRight-35}" y="${footerY+44}" text-anchor="middle" font-family="Arial" font-size="25" fill="#f7f3ea" stroke="none">★</text>
    <text x="${center}" y="${footerY+48}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${footerSize}" letter-spacing="7" stroke="none">NITTIE COFFEE &amp; EATERY</text>
  </g>
</svg>`;
}

for (const [letter, cfg] of Object.entries(layouts)) {
  fs.writeFileSync(path.join(outputDir, `photobox-layout-${letter}.svg`), svg(letter, cfg), 'utf8');
}

console.log(`Generated ${Object.keys(layouts).length} SVG layouts in ${outputDir}`);
