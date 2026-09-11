from pathlib import Path
import re, json, shutil
root=Path(__file__).resolve().parents[1]
site=root/'website'
backup=root/'work'/'prototype-before-react'
backup.mkdir(exist_ok=True)
for name in ['index.html','app.js','booth-core.js','booth-flow.js','style.css','booth-flow.css','package.json','server.mjs','build.mjs']:
    if not (backup/name).exists(): shutil.copy2(site/name,backup/name)
for folder in ['src/components','src/pages','src/booth','src/styles']:(site/folder).mkdir(parents=True,exist_ok=True)
def write(name,text): (site/name).write_text(text,encoding='utf-8')
html=(backup/'index.html').read_text(encoding='utf-8')
def jsx(s):
    s=re.sub(r'\bclass=', 'className=',s)
    s=re.sub(r'\btabindex=', 'tabIndex=',s)
    s=re.sub(r'<(br|img|input|hr)(\s[^>]*?)?>',lambda m:m[0][:-1]+' />',s)
    return s
home=html[html.index('    <div id="home">'):html.index('    <section id="about"')]
home=re.sub(r'<div class="hero-art".*?</span></div>\s*</section>', '<HeroArt />\n      </section>',home,flags=re.S)
write('src/pages/Home.tsx',"import { HeroArt } from '../components/HeroArt';\nexport function Home(){return ("+jsx(home)+");}\n")
about=html[html.index('    <section id="about"'):html.index('    <section id="booth"')].replace(' hidden','')
write('src/pages/About.tsx','export function About(){return ('+jsx(about)+');}\n')
dialog=html[html.index('    <dialog'):html.index('    <div id="print-sheet"')]
dialog=dialog.replace('<dialog id="instructions"','<dialog ref={dialogRef} onCancel={onDismiss} id="instructions"').replace('class="dialog-close"','class="dialog-close" onClick={onDismiss}').replace('id="instructions-continue"','id="instructions-continue" onClick={onContinue}')
write('src/components/Instructions.tsx',"import {useEffect,useRef} from 'react';\nexport function Instructions({open,onDismiss,onContinue}:{open:boolean;onDismiss:()=>void;onContinue:()=>void}){const dialogRef=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=dialogRef.current;if(open&&!d?.open)d?.showModal();if(!open&&d?.open)d.close();},[open]);return ("+jsx(dialog)+");}\n")
flow=(backup/'booth-flow.js').read_text(encoding='utf-8')
designs=re.search(r'const cardDesigns=(.*?);\n',flow)[1].replace('public/','/')
colors=re.search(r'const colors=(.*?);\n',flow)[1]
write('src/booth/designs.ts','export interface CardDesign {name:string;size:number[];crop:number[];slots:{x:number;y:number;w:number;h:number;r:number;poly?:number[][]}[];mask?:string;src:string}\nexport const cardDesigns:Record<string,CardDesign>='+designs+';\nexport const colors:Record<string,string[]>='+colors+';\n')
core=(backup/'booth-core.js').read_text(encoding='utf-8').replace('globalThis.BoothCore = (() => {','').replace('  return {layouts,filters,move,captureTargets,replaceShot,filterPixels};\n})();','export {layouts,filters,move,captureTargets,replaceShot,filterPixels};')
write('src/booth/core.js',core)
renderer=flow[flow.index('  async function renderDesignedCard()'):flow.index('  async function updatePreview()')]
renderer=renderer.replace('function renderDesignedCard()','function renderDesignedCard(state)').replace('function renderCard()','function renderCard(state)').replace('return renderDesignedCard()','return renderDesignedCard(state)')
helpers=flow[flow.index('  const loadImage='):flow.index('  async function takeShot()')]
write('src/booth/renderCard.js',"import { layouts,filterPixels } from './core';\nimport { cardDesigns,colors } from './designs';\n"+helpers+renderer+'\nexport {renderCard,loadImage,cover};\n')
for name in ['style.css','booth-flow.css']:shutil.copy2(backup/name,site/'src/styles'/name)
head=html[:html.index('  <link rel="stylesheet"')]
write('index.html',head+'</head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n')
write('package.json',json.dumps({'name':'together-photobooth','version':'0.2.0','private':True,'type':'module','packageManager':'pnpm@10.11.0','scripts':{'dev':'vite --host 127.0.0.1 --port 5173 --strictPort','build':'tsc --noEmit && vite build','preview':'vite preview --host 127.0.0.1 --port 5173 --strictPort','test':'node --test tests/*.test.mjs'},'dependencies':{'react':'^19.2.0','react-dom':'^19.2.0'},'devDependencies':{'@types/react':'^19.2.0','@types/react-dom':'^19.2.0','typescript':'^5.9.3','vite':'^7.1.0'}},indent=2)+'\n')
write('tsconfig.json',json.dumps({'compilerOptions':{'target':'ES2022','lib':['ES2022','DOM','DOM.Iterable'],'module':'ESNext','moduleResolution':'Bundler','jsx':'react-jsx','strict':True,'allowJs':True,'checkJs':False,'noEmit':True,'skipLibCheck':True,'allowImportingTsExtensions':True},'include':['src']},indent=2)+'\n')
