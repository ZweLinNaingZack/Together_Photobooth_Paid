import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';

function PhotoPairs() {
  return <div className="strip-photos">{[0, 1, 2].map(i => <div className="photo-pair" key={i}>{['woman', 'man'].map(person => <img key={person} src={`/${person}.jpg`} alt="" />)}</div>)}</div>;
}

export function HeroArt() {
  const [spread, setSpread] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const art = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 801px) and (hover: hover) and (pointer: fine)');
    const update = () => { setInteractive(desktop.matches); setSpread(false); };
    update(); desktop.addEventListener('change', update);
    const outside = (event: PointerEvent) => { if (!art.current?.contains(event.target as Node)) setSpread(false); };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); desktop.removeEventListener('change', update); };
  }, []);
  return <div ref={art} className={`hero-art ${interactive && spread ? 'cards-apart' : ''}`} role={interactive ? 'button' : 'img'} tabIndex={interactive ? 0 : undefined} aria-pressed={interactive ? spread : undefined} aria-label={interactive ? spread ? t('hero.together') : t('hero.separate') : t('hero.image')} aria-describedby={interactive ? 'card-hint' : undefined}
    onPointerEnter={e => { if (interactive && e.pointerType === 'mouse') setSpread(true); }}
    onPointerLeave={e => { if (e.pointerType === 'mouse') setSpread(false); }}
    onKeyDown={e => { if (!interactive) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSpread(value => !value); } if (e.key === 'Escape') setSpread(false); }} onBlur={() => setSpread(false)}>
    <div className="orbit-label">a little closer, from anywhere</div>
    <div className="strip strip-back"><div className="strip-top"><span>TOGETHER</span><span>01 / 04</span></div><PhotoPairs /><div className="strip-bottom"><span>you + me</span><small>DIFFERENT PLACES, SAME MOMENT.</small></div></div>
    <div className="strip strip-front"><div className="strip-top"><span>TOGETHER</span><span>♡</span></div><PhotoPairs /><div className="strip-bottom"><span>better together.</span><small>A LITTLE KEEPSAKE. A LOT OF LOVE.</small></div></div>
    <div className="photo-stamp"><span>MADE TO</span><strong>feel<br />closer.</strong><span>KEEP FOREVER</span></div>
    <div className="art-caption"><span className="caption-line" /> two webcams. one memory.</div><span id="card-hint" className="card-hint" hidden={!interactive}>{t('hero.hint')}</span>
  </div>;
}
