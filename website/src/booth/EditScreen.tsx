import { WarningNotice } from '../components/WarningNotice';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { layouts, filters } from './core';
import { cardDesigns, colors } from './designs';
import { renderCard, cardDimensions } from './renderCard';
import { PhotoTray } from './PhotoTray';
import { Heading } from './shared';
import type { CardState } from './types';
import { DesignScreen } from './DesignScreen';
import { musicTitles } from './musicTitle.js';
import { PhotoPan } from './PhotoPan';
import { recordDiagnostic,diagnosticReport } from './diagnostics.js';
import {ExpandedPhotoEditor} from './ExpandedPhotoEditor';
import {localDate} from './filmDate.js';

interface Props {
  photosLocked?: boolean;
  source?: 'camera' | 'upload';
  card: CardState; onChange: (patch: Partial<CardState>) => void;
  onMove: (from: number, to: number) => void; onRetake: (index: number) => void;
  onBack: () => void; onDesign: () => void;
  stage: 'design' | 'export'; onContinue: () => void;
}
export function EditScreen({ card, onChange, onMove, onRetake, onBack, onDesign, onContinue, stage, source = 'camera', photosLocked = false }: Props) {
  const [preview, setPreview] = useState('');
  const [expanded,setExpanded]=useState(false);
  const [today,setToday]=useState(localDate);
  useEffect(()=>{const timer=setInterval(()=>setToday(localDate()),30000);return()=>clearInterval(timer);},[]);
  const [renderedFrame,setRenderedFrame] = useState('');
  const [previewStatus, setPreviewStatus] = useState('Preparing your photocard…');
  const [previewError, setPreviewError] = useState(false), [retry, setRetry] = useState(0);
  const [format, setFormat] = useState('png'), [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false), alive = useRef(true);
  const renderQueue=useRef(Promise.resolve());
  const [savedExport,setSavedExport]=useState<{card:CardState;format:string;blob:Blob;url:string;date:string}|null>(null);
  const readyExport=savedExport?.card===card&&savedExport.format===format&&savedExport.date===localDate()?savedExport:null;
  useEffect(()=>()=>{if(savedExport)URL.revokeObjectURL(savedExport.url);},[savedExport]);
  const layout = layouts[card.layout];
  const { width, height } = cardDimensions(card);
  useEffect(() => {
    alive.current = true;
    const leave = () => { alive.current = false; };
    window.addEventListener('pagehide', leave);
    return () => { alive.current = false; window.removeEventListener('pagehide', leave); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setPreviewError(false);
    setPreviewStatus('Preparing your photocard…');
    const timer = window.setTimeout(() => {renderQueue.current=renderQueue.current.catch(()=>{}).then(async()=>{
      if(cancelled)return;
      try {
        const canvas = await renderCard({ ...card, preview: true, previewWidth:expanded?1200:600 });
        if (!cancelled) { setPreview(canvas.toDataURL('image/png')); setRenderedFrame(`${card.layout}:${card.template}`); setPreviewStatus('Your layout, photo order and filter are included in the download.'); }
        canvas.width=canvas.height=1;
      } catch { if (!cancelled) { recordDiagnostic('preview_failed');setPreviewError(true); setPreviewStatus('This frame couldn’t load. Retry or choose another frame.'); } }
    });}, 60);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [card, retry,today,expanded]);

  async function exportCard(print: boolean) {
    if (exportLock.current) return;
    exportLock.current = true; setExporting(true); setStatus(print ? 'Preparing your print…' : 'Preparing your download…');
    const started=performance.now();
    try {
      if(!print&&readyExport){const link=document.createElement('a');link.href=readyExport.url;link.download=`Together Memories.${format==='jpeg'?'jpg':'png'}`;link.click();setStatus('Download requested. You can also open or share the prepared image below.');return;}
      await renderQueue.current;
      const canvas = await renderCard(card);
      if (!alive.current) return;
      if (print) {
        const sheet = document.getElementById('print-sheet')!;
        const image = new Image(); image.alt = 'Your finished Together photocard'; image.src = canvas.toDataURL('image/png');
        image.style.width = `${layout.width / 300}in`; image.style.height = `${layout.width / 300 * canvas.height / canvas.width}in`;
        await image.decode();
        if (!alive.current) return;
        sheet.replaceChildren(image); window.print();
        setStatus('Print dialog requested. Choose 100% scaling to keep the card size.');
      } else {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${format}`, .95));
        if (!blob) throw new Error('Export failed');
        if (!alive.current) return;
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        setSavedExport({card,format,blob,url,date:localDate()});
        link.href = url; link.download = `Together Memories.${format === 'jpeg' ? 'jpg' : 'png'}`; link.click();
        recordDiagnostic('export_ready',performance.now()-started);canvas.width=canvas.height=1;setStatus('Your photocard is ready. Retry saving without rendering again.');
      }
    } catch { const reference=recordDiagnostic('export_failed');if (alive.current) setStatus(`Something went wrong. Your photos are still here. Retry or contact support with reference ${reference}.`); }
    finally { exportLock.current = false; if (alive.current) setExporting(false); }
  }
  return <><Heading eyebrow={stage === 'design' ? 'FRAME & FILTER' : 'YOUR FINISHED MOMENTS'} title={<>Your photos. <em>Your keepsake.</em></>} note={`${layout.name} · ${layout.note}. ${stage === 'design' ? 'Match a frame and filter to your photos.' : 'Ready to download or print.'}`} />
    <div className="finish-grid customization-grid"><div className="preview-workspace"><div className="final-preview">{preview ? <div className="pan-surface"><img id="card-preview" src={preview} alt="Your photocard preview" draggable={false} />{!exporting && renderedFrame === `${card.layout}:${card.template}` && <PhotoPan card={card} onChange={onChange} />}</div> : <span className="preview-placeholder">Preparing your photos…</span>}<p id="preview-status" role="status">{previewError ? 'Preview unavailable. Choose another frame or retry.' : previewStatus}</p>{previewError && <WarningNotice>{previewStatus}</WarningNotice>}{previewError && <button className="text-button" onClick={() => setRetry(value => value + 1)}>Retry frame</button>}</div>
    {stage === 'design' && <button className="outline-button expand-preview-button" disabled={!preview || exporting || renderedFrame !== `${card.layout}:${card.template}`} onClick={()=>setExpanded(true)}>Expand & position photos</button>}
    {stage === 'design' && <section className="editing-designs" aria-label="Frame selection"><h2>Choose your frame <small>Swipe to explore</small></h2><DesignScreen embedded card={card} onSelect={template => onChange({template})} onBack={onBack} onNext={onContinue} /></section>}</div>
      <div className="finish-controls"><p className="session-note">Drag a photo in the preview to adjust its crop. Use arrow keys when a photo is focused, or Home to center it.</p><button className="text-button" disabled={exporting} onClick={()=>onChange({offsets:card.shots.map(()=>({x:.5,y:.5}))})}>Reset photo positions</button><div className="chosen-design-note"><strong>{card.template ? cardDesigns[card.template].name : 'Classic'}</strong></div>
        {card.template && card.template in musicTitles && <fieldset disabled={exporting}><legend>MUSIC PLAYER TEXT</legend><label className="caption-label" htmlFor="track-title">SONG / TRACK TITLE</label><input id="track-title" maxLength={60} placeholder="Our little moment" value={card.trackTitle || ''} disabled={exporting} onChange={e => onChange({ trackTitle: e.target.value })} /><label className="caption-label" htmlFor="track-subtitle">ARTIST / SUBTITLE</label><input id="track-subtitle" maxLength={60} placeholder="Together" value={card.trackSubtitle || ''} disabled={exporting} onChange={e => onChange({ trackSubtitle: e.target.value })} /><p className="session-note">Up to 60 characters each. Text fits automatically.</p></fieldset>}
        {!card.template && <fieldset disabled={exporting}><legend>FRAME COLOR</legend><div className="swatches">{Object.entries(colors).map(([key, color]) => <button key={key} className={`swatch ${card.color === key ? 'active' : ''}`} aria-label={key} aria-pressed={card.color === key} style={{ '--swatch': color[0] } as CSSProperties} onClick={() => onChange({ color: key })} />)}</div></fieldset>}
        <fieldset disabled={exporting}><legend>PHOTO FILTER</legend><div className="filter-options">{Object.entries(filters).map(([key, name]) => <button key={key} className={`filter ${card.filter === key ? 'active' : ''}`} aria-pressed={card.filter === key} onClick={() => onChange({ filter: key })}>{name}</button>)}</div></fieldset>
        {!card.template && <><label className="caption-label" htmlFor="card-caption">A FEW WORDS TO KEEP</label><input id="card-caption" maxLength={28} value={card.caption} disabled={exporting} onChange={e => onChange({ caption: e.target.value })} /></>}
        <p className="session-note">{card.template ? 'Your selected design is ready. Filters apply only to your photos; the printed artwork stays unchanged.' : 'Filters apply to the photos. Your original captures stay unchanged.'}</p><button className="text-button" disabled={exporting || photosLocked} onClick={onBack}>Back to your photos</button>
      </div>
    </div>{stage === 'design' && <>{photosLocked && <p className="session-note">These photos are fixed for this editing session. You can adjust their position, frame and filter.</p>}<PhotoTray actionLabel={source === 'upload' ? 'Replace' : 'Retake'} shots={card.shots} count={layout.count} retake={null} disabled={exporting || photosLocked} onMove={onMove} onRetake={onRetake} /><div className="step-actions"><button className="primary" onClick={onContinue}>Continue to export</button></div></>}
    {stage === 'export' && readyExport && <div className="session-note"><a href={readyExport.url} target="_blank" rel="noopener noreferrer">Open full-size image</a><p>On your phone, open the image and press and hold to save, or use Share / Save below.</p>{typeof navigator.share==='function' && <button className="outline-button" onClick={async()=>{const file=new File([readyExport.blob],`Together Memories.${format==='jpeg'?'jpg':'png'}`,{type:readyExport.blob.type});try{if(!navigator.canShare?.({files:[file]})){setStatus('File sharing is unavailable here. Use Download or open the image.');return;}await navigator.share({files:[file],title:'Together Memories'});setStatus('Share sheet opened.');}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setStatus('Sharing is unavailable. Your prepared image is still ready to download.');}}}>Share / Save</button>}</div>}
    {stage === 'export' && <button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(diagnosticReport());setStatus('Support details copied. No photos or account details included.');}catch{setStatus('Copy is unavailable. Share the support reference shown with the error.');}}}>Copy support details</button>}
    {stage === 'export' && <div className="finish-bottom"><div><strong>Keep this little moment.</strong><p>{width} × {height} pixels. {card.template ? 'Sized to your artwork without added margins.' : `Print at ${layout.width / 300} × ${layout.height / 300} inches with 100% scaling.`}</p><button className="text-button" onClick={onDesign} disabled={exporting}>Back to frame & filter</button></div><div className="finish-buttons"><button className="outline-button" id="print-card" disabled={exporting} onClick={() => exportCard(true)}>Print</button><label className="sr-only" htmlFor="export-format">Download format</label><select id="export-format" value={format} disabled={exporting} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="jpeg">JPG</option></select><button className="primary" id="download-card" disabled={exporting} onClick={() => exportCard(false)}>Download</button></div><p id="export-status" role="status">{status.includes('Something went wrong') ? '' : status}</p>{status.includes('Something went wrong') && <WarningNotice>{status}</WarningNotice>}</div>}
    <ExpandedPhotoEditor open={expanded} onClose={()=>setExpanded(false)} preview={preview} card={card} onChange={onChange}/>
    {stage === 'export' && <div className="done-actions"><p>Save your photocard before leaving.</p><button className="outline-button" disabled={exporting} onClick={()=>{window.location.hash='#';}}>Done — Return to home</button></div>}
  </>;
}
