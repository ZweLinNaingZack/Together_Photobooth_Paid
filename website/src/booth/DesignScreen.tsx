import type { CSSProperties } from 'react';
import { layouts } from './core';
import { cardDesigns } from './designs';
import type { CardState } from './types';
import { Miniature } from './LayoutScreen';
import { Heading } from './shared';

export function DesignScreen({ card, onSelect, onBack, onNext, nextLabel = 'Take the photos now', busy = false }: { busy?: boolean; nextLabel?: string; card: CardState; onSelect: (key: string | null) => void; onBack: () => void; onNext: () => void }) {
  return <><Heading eyebrow="NEXT, A LITTLE PERSONALITY" title={<>A design that feels <em>like you.</em></>} note={`${layouts[card.layout].name} · ${layouts[card.layout].count} photos · Choose a design for your photos.`} />
    <fieldset className="card-design-gallery" disabled={busy}><legend className="sr-only">Choose photocard design</legend>
      {Object.entries(cardDesigns).filter(([, design]) => (design.layout || 'A') === card.layout).map(([key, design]) => {
        const [x, y, w, h] = design.crop;
        return <label className="card-design-option" key={key}><input type="radio" name="card-template" checked={card.template === key} onChange={() => onSelect(key)} /><span className="card-design-face"><span className="card-art-stage"><span className="card-art-window" style={{ aspectRatio: `${w}/${h}`, '--art-ratio': w / h } as CSSProperties}><img src={design.src} alt={`${design.name} ${design.slots.length}-photo design`} loading="lazy" style={{ width: `${design.size[0] / w * 100}%`, height: `${design.size[1] / h * 100}%`, left: `${-x / w * 100}%`, top: `${-y / h * 100}%` }} /></span></span><strong>{design.name}</strong><small>{design.slots.length} photos</small></span></label>;
      })}
      <label className="card-design-option"><input type="radio" name="card-template" checked={!card.template} onChange={() => onSelect(null)} /><span className="card-design-face"><span className="plain-design-thumb"><Miniature layout={layouts[card.layout]} /></span><strong>Classic</strong><small>Your colors, your caption</small></span></label>
    </fieldset><div className="step-actions"><button className="text-button" id="back-layout" disabled={busy} onClick={onBack}>Change photo source</button><button className="primary" id="design-continue" disabled={busy} onClick={onNext}>{nextLabel}</button></div>
  </>;
}
