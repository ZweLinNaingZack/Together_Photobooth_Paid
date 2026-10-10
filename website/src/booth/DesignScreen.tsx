import type { CSSProperties } from 'react';
import { layouts } from './core';
import { cardDesigns } from './designs';
import type { CardState } from './types';
import { Miniature } from './LayoutScreen';
import { Heading } from './shared';
import { thumbnailUrl } from './frameAssets';
import {filmDateRegion,localDate} from './filmDate.js';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { layoutName } from '../i18n/layouts';

export function DesignScreen({ card, onSelect, onBack, onNext, nextLabel, busy = false, embedded = false }: { embedded?: boolean; busy?: boolean; nextLabel?: string; card: CardState; onSelect: (key: string | null) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  return <>{!embedded && <Heading eyebrow={t('design.eyebrow')} title={<Rich text={t('design.title')} />} note={t('design.note', { layout: layoutName(layouts[card.layout]), n: layouts[card.layout].count })} />}
    <fieldset className={`card-design-gallery ${embedded ? 'frame-carousel' : ''}`} disabled={busy}><legend className="sr-only">{t('design.legend')}</legend>
      {Object.entries(cardDesigns).filter(([, design]) => (design.layout || 'A') === card.layout).map(([key, design]) => {
        const [, , w, h] = design.crop;
        const dateRegion=filmDateRegion(key);
        return <label className="card-design-option" key={key}><input type="radio" name="card-template" checked={card.template === key} onChange={() => onSelect(key)} /><span className="card-design-face"><span className="card-art-stage"><span className="card-art-window frame-thumbnail" style={{ aspectRatio: `${w}/${h}`, '--art-ratio': w / h } as CSSProperties}><img src={thumbnailUrl(key)} alt={t('design.alt', { name: design.name, n: design.slots.length })} loading="lazy" decoding="async" onLoad={e => e.currentTarget.classList.add('loaded')} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />{dateRegion&&<svg className="film-date-thumb" viewBox={design.crop.join(' ')} aria-hidden="true"><rect x={dateRegion.x} y={dateRegion.y} width={dateRegion.w} height={dateRegion.h} fill="black"/><text x={dateRegion.x+dateRegion.w/2} y={dateRegion.y+dateRegion.h/2} textAnchor="middle" dominantBaseline="central" fill="white" fontFamily="Arial, sans-serif" fontSize={dateRegion.size}>{localDate()}</text></svg>}</span></span><strong>{design.name}</strong><small>{t('design.photos', { n: design.slots.length })}</small></span></label>;
      })}
      <label className="card-design-option"><input type="radio" name="card-template" checked={!card.template} onChange={() => onSelect(null)} /><span className="card-design-face"><span className="plain-design-thumb"><Miniature layout={layouts[card.layout]} /></span><strong>{t('design.classic')}</strong><small>{t('design.classicNote')}</small></span></label>
    </fieldset>{!embedded && <div className="step-actions"><button className="text-button" id="back-layout" disabled={busy} onClick={onBack}>{t('design.back')}</button><button className="primary" id="design-continue" disabled={busy} onClick={onNext}>{nextLabel ?? t('edit.toExport')}</button></div>}
  </>;
}
