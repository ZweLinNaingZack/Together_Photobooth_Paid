const fs=require('fs');
const root='C:/Users/Zwe Lin Naing/Documents/Codex/2026-09-09/build-x20/outputs/together/';
let html=fs.readFileSync(root+'index.html','utf8');
html=html.replace(/https:\/\/fonts.googleapis.com\/css2\?[^"\s]+/,'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Instrument+Serif:ital@0;1&display=swap');
let css=fs.readFileSync(root+'booth-flow.css','utf8');
css+=`
/* Page titles use DM Sans; keep the photographic lettering in the artwork. */
body h1,body h2,body h3{font-family:var(--sans);font-weight:500;line-height:1.12;letter-spacing:-.04em}
body h1 em,body h2 em{font-weight:500}
.hero-copy{min-width:0}.hero h1{font-size:clamp(44px,5vw,72px);letter-spacing:-.055em;line-height:1.08}
.hero .title-star{font-size:.65em;margin-left:15px}
.hero-art{height:650px}.hero-art .art-caption{bottom:-12px;right:27px}.hero-art .card-hint{bottom:-40px}
.reference-picker .layout-choice>strong,.layout-choice>strong,.review-heading strong,.finish-bottom strong,.chosen-design-note>strong{font-family:var(--sans);font-weight:500;font-size:22px;letter-spacing:-.025em}
@media(max-width:800px){.hero h1{font-size:clamp(42px,8.5vw,68px)}.hero-art{height:650px}.hero-art .art-caption{bottom:-12px}}
@media(max-width:420px){.hero h1{font-size:clamp(36px,10.4vw,44px)}.hero-art{height:650px}.hero-art .card-hint{bottom:-40px}}
`;
fs.mkdirSync('work/title-update',{recursive:true});fs.writeFileSync('work/title-update/index.html',html);fs.writeFileSync('work/title-update/booth-flow.css',css);
console.log('Prepared DM Sans title styling and caption clearance.');
