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
import { useT, type Key } from '../i18n';
import { Rich } from '../i18n/Rich';
import { layoutName, layoutNote } from '../i18n/layouts';

interface Props {
  photosLocked?: boolean;
  source?: 'camera' | 'upload';
  card: CardState; onChange: (patch: Partial<CardState>) => void;
  onMove: (from: number, to: number) => void; onRetake: (index: number) => void;
  onBack: () => void; onDesign: () => void;
  stage: 'design' | 'export'; onContinue: () => void;
}
export function EditScreen({ card, onChange, onMove, onRetake, onBack, onDesign, onContinue, stage, source = 'camera', photosLocked = false }: Props) {
  const t = useT();
  const [preview, setPreview] = useState('');
  const [expanded,setExpanded]=useState(false);
  const [today,setToday]=useState(localDate);
  useEffect(()=>{const timer=setInterval(()=>setToday(localDate()),30000);return()=>clearInterval(timer);},[]);
  const [renderedFrame,setRenderedFrame] = useState('');
  const [previewStatus, setPreviewStatus] = useState<Key>('edit.preparingCard');
  const [previewError, setPreviewError] = useState(false), [retry, setRetry] = useState(0);
  const [format, setFormat] = useState('png'), [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);   // the last download attempt failed
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
    setPreviewStatus('edit.preparingCard');
    const timer = window.setTimeout(() => {renderQueue.current=renderQueue.current.catch(()=>{}).then(async()=>{
      if(cancelled)return;
      try {
        const canvas = await renderCard({ ...card, preview: true, previewWidth:expanded?1200:600 });
        if (!cancelled) { setPreview(canvas.toDataURL('image/png')); setRenderedFrame(`${card.layout}:${card.template}`); setPreviewStatus('edit.previewReady'); }
        canvas.width=canvas.height=1;
      } catch { if (!cancelled) { recordDiagnostic('preview_failed');setPreviewError(true); setPreviewStatus('edit.frameFailed'); } }
    });}, 60);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [card, retry,today,expanded]);

  async function exportCard(print: boolean) {
    if (exportLock.current) return;
    exportLock.current = true; setExporting(true); setFailed(false); setStatus(t(print ? 'edit.preparingPrint' : 'edit.preparingDownload'));
    const started=performance.now();
    try {
      if(!print&&readyExport){const link=document.createElement('a');link.href=readyExport.url;link.download=`Together Memories.${format==='jpeg'?'jpg':'png'}`;link.click();setStatus(t('edit.downloadRequested'));return;}
      await renderQueue.current;
      const canvas = await renderCard(card);
      if (!alive.current) return;
      if (print) {
        const sheet = document.getElementById('print-sheet')!;
        const image = new Image(); image.alt = t('edit.finishedAlt'); image.src = canvas.toDataURL('image/png');
        image.style.width = `${layout.width / 300}in`; image.style.height = `${layout.width / 300 * canvas.height / canvas.width}in`;
        await image.decode();
        if (!alive.current) return;
        sheet.replaceChildren(image); window.print();
        setStatus(t('edit.printRequested'));
      } else {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${format}`, .95));
        if (!blob) throw new Error('Export failed');
        if (!alive.current) return;
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        setSavedExport({card,format,blob,url,date:localDate()});
        link.href = url; link.download = `Together Memories.${format === 'jpeg' ? 'jpg' : 'png'}`; link.click();
        recordDiagnostic('export_ready',performance.now()-started);canvas.width=canvas.height=1;setStatus(t('edit.ready'));
      }
    } catch { const reference=recordDiagnostic('export_failed');if (alive.current) { setFailed(true); setStatus(t('edit.exportFailed', { reference })); } }
    finally { exportLock.current = false; if (alive.current) setExporting(false); }
  }
  return <><Heading eyebrow={t(stage === 'design' ? 'edit.eyebrow.design' : 'edit.eyebrow.export')} title={<Rich text={t('edit.title')} />} note={`${layoutName(layout)} · ${layoutNote(layout)}. ${t(stage === 'design' ? 'edit.note.design' : 'edit.note.export')}`} />
    <div className={`finish-grid customization-grid ${stage === 'export' ? 'export-preview-grid' : ''}`}><div className="preview-workspace">{stage === 'design' && <div className="preview-toolbar"><span>{t('edit.yourCard')}</span><label className="preview-filter"><span className="sr-only">{t('edit.filter')}</span><select aria-label={t('edit.filter')} value={card.filter} disabled={exporting} onChange={e => onChange({filter:e.target.value})}>{Object.keys(filters).map(key=><option key={key} value={key}>{t(`filter.${key}` as Key)}</option>)}</select></label></div>}<div className="final-preview">{preview ? <div className="pan-surface"><img id="card-preview" src={preview} alt={t('edit.previewAlt')} draggable={false} />{stage === 'design' && !exporting && renderedFrame === `${card.layout}:${card.template}` && <PhotoPan card={card} onChange={onChange} />}</div> : <span className="preview-placeholder">{t('edit.preparingPhotos')}</span>}<p id="preview-status" role="status">{previewError ? t('edit.previewFailed') : t(previewStatus)}</p>{previewError && <WarningNotice>{t(previewStatus)}</WarningNotice>}{previewError && <button className="text-button" onClick={() => setRetry(value => value + 1)}>{t('edit.retryFrame')}</button>}</div>
    {stage === 'design' && <button className="outline-button expand-preview-button" disabled={!preview || exporting || renderedFrame !== `${card.layout}:${card.template}`} onClick={()=>setExpanded(true)}>{t('edit.expand')}</button>}
    {stage === 'design' && <section className="editing-designs" aria-label={t('edit.frames')}><h2>{t('edit.chooseFrame')} <small>{t('edit.swipe')}</small></h2><DesignScreen embedded card={card} onSelect={template => onChange({template})} onBack={onBack} onNext={onContinue} /></section>}</div>
      {stage === 'design' && <div className="finish-controls"><p className="session-note">{t('edit.dragHelp')}</p><button className="text-button" disabled={exporting} onClick={()=>onChange({offsets:card.shots.map(()=>({x:.5,y:.5}))})}>{t('edit.resetPositions')}</button><div className="chosen-design-note"><strong>{card.template ? cardDesigns[card.template].name : t('design.classic')}</strong></div>
        {card.template && card.template in musicTitles && <fieldset disabled={exporting}><legend>{t('edit.music.legend')}</legend><label className="caption-label" htmlFor="track-title">{t('edit.music.title')}</label><input id="track-title" maxLength={60} placeholder={t('edit.music.titlePlaceholder')} value={card.trackTitle || ''} disabled={exporting} onChange={e => onChange({ trackTitle: e.target.value })} /><label className="caption-label" htmlFor="track-subtitle">{t('edit.music.subtitle')}</label><input id="track-subtitle" maxLength={60} placeholder="Together" value={card.trackSubtitle || ''} disabled={exporting} onChange={e => onChange({ trackSubtitle: e.target.value })} /><p className="session-note">{t('edit.music.help')}</p></fieldset>}
        {!card.template && <fieldset disabled={exporting}><legend>{t('edit.color')}</legend><div className="swatches">{Object.entries(colors).map(([key, color]) => <button key={key} className={`swatch ${card.color === key ? 'active' : ''}`} aria-label={t(`color.${key}` as Key)} aria-pressed={card.color === key} style={{ '--swatch': color[0] } as CSSProperties} onClick={() => onChange({ color: key })} />)}</div></fieldset>}
        {!card.template && <><label className="caption-label" htmlFor="card-caption">{t('edit.caption')}</label><input id="card-caption" maxLength={28} value={card.caption} disabled={exporting} onChange={e => onChange({ caption: e.target.value })} /></>}
        <p className="session-note">{t(card.template ? 'edit.filterNote.design' : 'edit.filterNote.classic')}</p><button className="text-button" disabled={exporting || photosLocked} onClick={onBack}>{t('design.back')}</button>
      </div>}
    </div>{stage === 'design' && <>{photosLocked && <p className="session-note">{t('edit.locked')}</p>}<PhotoTray actionLabel={t(source === 'upload' ? 'tray.replace' : 'tray.retake')} shots={card.shots} count={layout.count} retake={null} disabled={exporting || photosLocked} onMove={onMove} onRetake={onRetake} /><div className="step-actions"><button className="primary" onClick={onContinue}>{t('edit.toExport')}</button></div></>}
    {stage === 'export' && readyExport && <div className="session-note export-help"><a className="outline-button" href={readyExport.url} target="_blank" rel="noopener noreferrer">{t('edit.openFull')}</a><p>{t('edit.phoneSave')}</p>{typeof navigator.share==='function' && <button className="outline-button" onClick={async()=>{const file=new File([readyExport.blob],`Together Memories.${format==='jpeg'?'jpg':'png'}`,{type:readyExport.blob.type});try{if(!navigator.canShare?.({files:[file]})){setStatus(t('edit.shareUnavailable'));return;}await navigator.share({files:[file],title:'Together Memories'});setStatus(t('edit.shareOpened'));}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setStatus(t('edit.shareFailed'));}}}>{t('edit.share')}</button>}</div>}
    {stage === 'export' && <div className="finish-bottom"><div><strong>{t('edit.keep')}</strong><p>{t('edit.pixels', { w: width, h: height })} {card.template ? t('edit.sizeDesign') : t('edit.sizePrint', { w: layout.width / 300, h: layout.height / 300 })}</p><button className="text-button" onClick={onDesign} disabled={exporting}>{t('edit.backToDesign')}</button></div><div className="finish-buttons"><button className="primary" id="download-card" disabled={exporting} onClick={() => exportCard(false)}>{t('edit.download')}</button></div><p id="export-status" role="status">{failed ? '' : status}</p>{failed && <WarningNotice>{status}</WarningNotice>}</div>}
    <ExpandedPhotoEditor open={expanded} onClose={()=>setExpanded(false)} preview={preview} card={card} onChange={onChange}/>
    {stage === 'export' && <div className="done-actions"><p>{t('edit.saveBeforeLeaving')}</p><button className="outline-button" disabled={exporting} onClick={()=>{window.location.hash='#';}}>{t('edit.done')}</button></div>}
  </>;
}
