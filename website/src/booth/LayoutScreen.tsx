import { layouts } from './core';
import type { LayoutId } from './types';
import { Heading } from './shared';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { layoutLabel, layoutName, layoutNote } from '../i18n/layouts';

export function Miniature({ layout }: { layout: typeof layouts.A }) {
  return <span className={`reference-mini ${layout.width > layout.height ? 'landscape' : layout.width === 600 ? 'narrow' : 'portrait'}`} style={{ aspectRatio: `${layout.width}/${layout.height}` }}>{layout.slots.map((r, i) => <i key={i} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}>{i + 1}</i>)}</span>;
}

export function LayoutScreen({ selected, onSelect, onBack, onNext, busy = false }: { busy?: boolean; selected: LayoutId; onSelect: (id: LayoutId) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  return <><Heading eyebrow={t('layout.eyebrow')} title={<Rich text={t('layout.title')} />} note={t('layout.lead')} />
    <fieldset className="layout-picker reference-picker" disabled={busy}><legend className="sr-only">{t('layout.legend')}</legend>{Object.entries(layouts).filter(([key]) => !['F', 'I', 'J'].includes(key)).map(([key, layout]) => <label className="layout-option" key={key}><input type="radio" name="layout" value={key} checked={selected === key} onChange={() => onSelect(key as LayoutId)} /><span className="layout-choice"><span className="mini-stage"><Miniature layout={layout} /></span><strong>{layoutName(layout)}</strong><span>{layoutNote(layout)}</span><small>{layoutLabel(key)}</small><span className="layout-check" aria-hidden="true">✓</span></span></label>)}</fieldset>
    <div className="step-actions"><p>{t('layout.help')}</p><button className="text-button" disabled={busy} onClick={onBack}>{t('duo.back')}</button><button className="primary" id="start-session" disabled={busy} onClick={onNext}>{busy ? t('layout.preparing') : t('layout.continue')}</button></div>
  </>;
}
