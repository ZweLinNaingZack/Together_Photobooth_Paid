import { layouts } from './core';
import type { LayoutId } from './types';
import { Heading } from './shared';

export function Miniature({ layout }: { layout: typeof layouts.A }) {
  return <span className={`reference-mini ${layout.width > layout.height ? 'landscape' : layout.width === 600 ? 'narrow' : 'portrait'}`} style={{ aspectRatio: `${layout.width}/${layout.height}` }}>{layout.slots.map((r, i) => <i key={i} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}>{i + 1}</i>)}</span>;
}

export function LayoutScreen({ selected, onSelect, onBack, onNext, busy = false }: { busy?: boolean; selected: LayoutId; onSelect: (id: LayoutId) => void; onBack: () => void; onNext: () => void }) {
  return <><Heading eyebrow="FIRST, A LITTLE SHAPE" title={<>Every memory needs <em>a frame.</em></>} note="Eight ways to keep a moment. Choose your size and arrangement." />
    <fieldset className="layout-picker reference-picker" disabled={busy}><legend className="sr-only">Photocard layout</legend>{Object.entries(layouts).filter(([key]) => !['F', 'I', 'J'].includes(key)).map(([key, layout]) => <label className="layout-option" key={key}><input type="radio" name="layout" value={key} checked={selected === key} onChange={() => onSelect(key as LayoutId)} /><span className="layout-choice"><span className="mini-stage"><Miniature layout={layout} /></span><strong>{layout.name}</strong><span>{layout.note}</span><small>{layout.label}</small><span className="layout-check" aria-hidden="true">✓</span></span></label>)}</fieldset>
    <div className="step-actions"><p>Your layout sets the number of photos to take or upload. Choose your frame after reviewing your photos.</p><button className="text-button" disabled={busy} onClick={onBack}>Change photo source</button><button className="primary" id="start-session" disabled={busy} onClick={onNext}>{busy ? 'Preparing your booth…' : 'Continue to photos'}</button></div>
  </>;
}
