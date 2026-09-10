const fs=require('fs');
const root='C:/Users/Zwe Lin Naing/Documents/Codex/2026-09-09/build-x20/outputs/together/';
fs.mkdirSync('work/dm-sans',{recursive:true});
for(const file of ['style.css','booth-flow.css','booth-flow.js','index.html']){
 let text=fs.readFileSync(root+file,'utf8');
 if(file.endsWith('.css')){
  text=text.replace("--serif:'Instrument Serif',Georgia,serif;",'').replaceAll('var(--serif)','var(--sans)').replaceAll('font-family:Arial,sans-serif','font-family:var(--sans)');
  if(file==='style.css')text+='\n/* DM Sans is the shared typeface for all live text. */\nbody,button,input,select,textarea{font-family:var(--sans)}\n@media(max-width:420px){.header .wordmark{font-size:28px;letter-spacing:-1.5px}.header .brand-dot{font-size:21px}}\n';
 }
 if(file.endsWith('.js'))text=text.replaceAll('"Instrument Serif", Georgia','"DM Sans", sans-serif').replaceAll('"DM Sans", Arial','"DM Sans", sans-serif').replaceAll('px Georgia','px "DM Sans", sans-serif');
 if(file.endsWith('.html'))text=text.replace('&family=Instrument+Serif:ital@0;1','');
 fs.writeFileSync('work/dm-sans/'+file,text);
 if(/Instrument|Georgia|var\(--serif\)/.test(text))throw Error('Old font remains in '+file);
}
console.log('Prepared DM Sans across CSS, font loading, and canvas text.');
