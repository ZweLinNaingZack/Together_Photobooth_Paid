// ---------------------------------------------------------------------------
// Home page demo: a practice booth that never opens the camera.
//
// It walks through the real flow in three stages (choose → shoot → keep) and
// reuses the booth's own pieces so the demo always behaves like the real thing:
// - captureSequence (timer / tap-by-tap / flash timing)  → booth/capture.js
// - ScreenFlash + flashColors (the coloured screen flash) → booth/ScreenFlash.tsx
// - cameraSound (countdown beeps and shutter)             → booth/cameraSounds.js
// - combinePortraits (how a duo photo is joined)          → booth/cameraQuality.js
// - renderCard + cardDesigns (the photocard itself)       → booth/renderCard.js
// The only fake part is the "camera": each photo is cut from a bundled sample
// picture (/woman.jpg, /man.jpg) instead of a live video frame.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { captureSequence } from '../booth/capture';
import { ScreenFlash, flashColors } from '../booth/ScreenFlash';
import type { FlashColor } from '../booth/ScreenFlash';
import { unlockCameraSound, cameraSound } from '../booth/cameraSounds.js';
import { combinePortraits } from '../booth/cameraQuality.js';
import { renderCard } from '../booth/renderCard';
import { cardDesigns } from '../booth/designs';
import { loadFrame, thumbnailUrl } from '../booth/frameAssets';
import { useT, type Key } from '../i18n';
import { Rich } from '../i18n/Rich';
import './booth-demo.css';

type Mode = 'solo' | 'duo';
type Stage = 'mode' | 'shoot' | 'card';
type Method = 'timer' | 'manual';

/** Layout A (three photos) is the classic strip, and these frames all use it. */
const PHOTO_COUNT = 3;
const DESIGNS = ['film-negative', 'ticket-memories', 'movie-time', 'story-today'] as const;
const FILTERS = ['original', 'vivid', 'vintage', 'bw', 'pink', 'fade'] as const;
const SECONDS = [3, 5, 7] as const;

/** The sample "people". `focus` is where the face sits (0–1), so every crop keeps the face in view. */
const SAMPLES = {
  you: { src: '/woman.jpg', focus: { x: 0.56, y: 0.4 } },
  person: { src: '/man.jpg', focus: { x: 0.5, y: 0.4 } },
};
type Sample = typeof SAMPLES.you;

/** Three little "poses": each photo is framed a bit differently so the strip doesn't look copy-pasted. */
const POSES = [
  { zoom: 1, dx: 0, dy: 0 },
  { zoom: 1.2, dx: -0.04, dy: 0.02 },
  { zoom: 1.38, dx: 0.04, dy: -0.01 },
];

// Decoded sample pictures, shared by every photo the demo takes.
const images = new Map<string, Promise<HTMLImageElement>>();
function sampleImage(src: string) {
  let pending = images.get(src);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => { images.delete(src); reject(new Error('Sample photo could not load')); };
      image.src = src;
    });
    images.set(src, pending);
  }
  return pending;
}

/**
 * "Takes" one photo from a sample picture: crops it like a camera frame (aspect = width / height),
 * then, if the flash is on, washes it with the flash colour the way a lit screen tints a face.
 */
async function samplePhoto(sample: Sample, aspect: number, width: number, pose: typeof POSES[number], flash: string | null) {
  const image = await sampleImage(sample.src);
  const iw = image.naturalWidth, ih = image.naturalHeight;
  const ch = Math.min(ih, iw / aspect) / pose.zoom, cw = ch * aspect;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  const sx = clamp((sample.focus.x + pose.dx) * iw - cw / 2, iw - cw);
  const sy = clamp((sample.focus.y + pose.dy) * ih - ch / 2, ih - ch);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = Math.round(width / aspect);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  if (flash) {
    // soft-light keeps skin and shadows natural; a light 'screen' pass adds the glow.
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.5;
    ctx.fillStyle = flash; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const data = canvas.toDataURL('image/jpeg', 0.9);
  canvas.width = canvas.height = 1;   // free the pixels right away (same habit as the booth)
  return data;
}

/** One finished photo: solo is a 4:3 frame; duo is two portraits joined side by side, like the real duo booth. */
async function takeDemoPhoto(mode: Mode, index: number, flash: string | null) {
  const pose = POSES[index % POSES.length];
  if (mode === 'solo') return samplePhoto(SAMPLES.you, 4 / 3, 1200, pose, flash);
  const [left, right] = await Promise.all([samplePhoto(SAMPLES.you, 3 / 4, 720, pose, flash), samplePhoto(SAMPLES.person, 3 / 4, 720, pose, flash)]);
  return combinePortraits(left, right);
}

// Small line icons, drawn like the step chips above this section.
const icon = (path: ReactNode) => <svg aria-hidden="true" focusable="false" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const Icons = {
  solo: icon(<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></>),
  duo: icon(<><circle cx="8.5" cy="8.5" r="3.1" /><circle cx="16.2" cy="9.4" r="2.6" /><path d="M2.8 19.5c.6-3.1 2.9-4.9 5.7-4.9s5.1 1.8 5.7 4.9M15 14.8c2.9-.4 5.4 1.2 6.2 4.2" /></>),
  timer: icon(<><circle cx="12" cy="13.5" r="7" /><path d="M12 10v3.8l2.4 1.6M9.5 3h5" /></>),
  tap: icon(<><path d="M9 11.5V5.8a1.8 1.8 0 0 1 3.6 0v5.2" /><path d="M12.6 10.6a1.8 1.8 0 0 1 3.4.8v.6a1.8 1.8 0 0 1 3.4.8V17a5 5 0 0 1-5 5h-1.6a5 5 0 0 1-4-2l-2.9-3.9a1.7 1.7 0 0 1 2.6-2.2L9 15.5" /></>),
  flash: icon(<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />),
  sound: icon(<><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>),
  camera: icon(<><path d="M4 8.2h3l1.6-2.4h6.8L17 8.2h3v11H4z" /><circle cx="12" cy="13.4" r="3.4" /></>),
  download: icon(<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />),
  again: icon(<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />),
  arrow: icon(<path d="M5 12h14m-5-5 5 5-5 5" />),
};

export function BoothDemo() {
  const t = useT();
  const [stage, setStage] = useState<Stage>('mode');
  const [mode, setMode] = useState<Mode>('solo');
  // Booth settings: the same choices (and defaults) as the real camera screen.
  const [method, setMethod] = useState<Method>('timer');
  const [seconds, setSeconds] = useState<number>(3);
  const [flash, setFlash] = useState(true);
  const [flashColor, setFlashColor] = useState<FlashColor>('white');
  const [sound, setSound] = useState(false);
  // Capture state.
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [taking, setTaking] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | string | null>(null);
  const [flashLit, setFlashLit] = useState(false);
  const [shutter, setShutter] = useState(0);
  const [failed, setFailed] = useState(false);
  // Photocard state.
  const [design, setDesign] = useState<string>(DESIGNS[0]);
  const [filter, setFilter] = useState<string>('original');
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const view = useRef<HTMLDivElement>(null);
  const stageTop = useRef<HTMLDivElement>(null);
  const capture = useRef<AbortController | null>(null);
  const takingIndex = useRef(0);

  const filled = shots.filter(Boolean).length;
  const complete = filled === PHOTO_COUNT;

  // Stop any countdown when the demo closes (page change) so no timers outlive it.
  useEffect(() => () => capture.current?.abort(), []);
  // Countdown beeps, exactly like the booth: one beep per number, a higher one on "1".
  useEffect(() => { if (sound && typeof countdown === 'number' && countdown > 0) cameraSound(countdown); }, [countdown, sound]);
  // Warm the chosen frame while they are still taking photos, so the card appears quickly.
  useEffect(() => { if (stage !== 'mode') void loadFrame(cardDesigns[design].src).catch(() => {}); }, [stage, design]);

  // Draw the photocard whenever the frame, filter or photos change.
  // The previous card stays on screen (dimmed) until the new one is ready, so nothing flickers.
  useEffect(() => {
    if (stage !== 'card' || !complete) return;
    let cancelled = false;
    setRendering(true); setCardError(false);
    renderCard({ layout: 'A', shots, template: design, filter, color: 'cream', caption: '', design: 'plain', preview: true, previewWidth: 600 })
      .then((canvas: HTMLCanvasElement) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92)))
      .then(blob => { if (!cancelled && blob) setCardUrl(URL.createObjectURL(blob)); })
      .catch(() => { if (!cancelled) setCardError(true); })
      .finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [stage, complete, shots, design, filter]);
  // Free each old card image once a newer one replaces it (and the last one when the demo closes).
  useEffect(() => () => { if (cardUrl) URL.revokeObjectURL(cardUrl); }, [cardUrl]);

  const stop = () => { capture.current?.abort(); capture.current = null; };

  const go = (next: Stage) => {
    stop();
    setStage(next);
    // Keep the stage in view on phones, where each step is taller than the screen.
    requestAnimationFrame(() => stageTop.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const chooseMode = (value: Mode) => {
    setMode(value); setShots([]); setFailed(false); setCardUrl(null);
    go('shoot');
  };

  const startOver = () => { setShots([]); setCardUrl(null); setFilter('original'); go('mode'); };

  // Retaking a photo changes the card, so the old drawing is dropped when going back to the photos.
  const backToPhotos = () => { setCardUrl(null); go('shoot'); };

  /** Runs the booth's own capture sequence. `retake` is a photo number to replace, or null for the next empty ones. */
  const shoot = async (retake: number | null = null) => {
    if (busy) return;
    if (sound) unlockCameraSound();
    const controller = new AbortController();
    capture.current = controller;
    setBusy(true); setFailed(false);
    try {
      await captureSequence({
        shots, count: PHOTO_COUNT, retake, method, seconds, signal: controller.signal, flash,
        onTaking: (index: number) => { takingIndex.current = index; setTaking(index); },
        onCountdown: setCountdown,
        onFlash: setFlashLit,
        onShutter: () => { setShutter(value => value + 1); if (sound) cameraSound('shutter'); },
        takeShot: () => takeDemoPhoto(mode, takingIndex.current, flash ? flashColors[flashColor].color : null),
        onShot: (index: number, photo: string) => { setShots(current => { const next = [...current]; next[index] = photo; return next; }); },
      });
    } catch {
      // Stopping the countdown is not an error; anything else shows a gentle retry note.
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (capture.current === controller) capture.current = null;
      setBusy(false); setTaking(null); setCountdown(null); setFlashLit(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      // Full-size export, the same renderer the real booth uses for downloads.
      const canvas: HTMLCanvasElement = await renderCard({ layout: 'A', shots, template: design, filter, color: 'cream', caption: '', design: 'plain' });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Export failed');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'Together Photobooth sample.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    } catch { setCardError(true); }
    finally { setDownloading(false); }
  };

  const steps: [Stage, Key][] = [['mode', 'demo.step.mode'], ['shoot', 'demo.step.shoot'], ['card', 'demo.step.card']];
  const stageIndex = steps.findIndex(([value]) => value === stage);
  const nextEmpty = Array.from({ length: PHOTO_COUNT }, (_, i) => i).find(i => !shots[i]) ?? 0;
  const status = failed ? t('session.captureFailed')
    : busy && taking !== null ? t('session.taking', { n: taking + 1, total: PHOTO_COUNT })
    : complete ? t('demo.allReady')
    : method === 'manual' ? t('session.manualHelp') : t('session.timerHelp', { n: seconds });

  return <section id="demo" className="booth-demo" aria-labelledby="demo-title">
    <div className="demo-intro">
      <div className="eyebrow">{t('demo.eyebrow')}</div>
      <h2 id="demo-title"><Rich text={t('demo.title')} /></h2>
      <p>{t('demo.lead')}</p>
    </div>

    <div className="demo-stage" ref={stageTop}>
      <div className="demo-stage-bar">
        <ol className="demo-progress" aria-label={t('demo.progressLabel')}>
          {steps.map(([value, key], i) => <li key={value} className={i < stageIndex ? 'done' : i === stageIndex ? 'current' : ''} aria-current={i === stageIndex ? 'step' : undefined}><span>{i + 1}</span>{t(key)}</li>)}
        </ol>
        {stage !== 'mode' && <div className="demo-bar-tools">
          <span className="demo-mode-pill">{mode === 'solo' ? Icons.solo : Icons.duo}{t(mode === 'solo' ? 'demo.solo.title' : 'demo.duo.title')}</span>
          {stage === 'shoot' && <button type="button" className="demo-chip-button" aria-pressed={sound} onClick={() => { unlockCameraSound(); setSound(value => !value); }}>{Icons.sound}{t('session.sound', { state: t(sound ? 'common.on' : 'common.off') })}</button>}
        </div>}
      </div>

      {stage === 'mode' && <div className="demo-modes">
        <p className="demo-question">{t('demo.mode.question')}</p>
        <div className="demo-mode-options">
          <button type="button" className="demo-mode" onClick={() => chooseMode('solo')}>
            <span className="demo-icon-chip" aria-hidden="true">{Icons.solo}</span>
            <span className="demo-faces" aria-hidden="true"><img src={SAMPLES.you.src} alt="" loading="lazy" /></span>
            <strong>{t('demo.solo.title')}</strong>
            <span className="demo-mode-text">{t('demo.solo.text')}</span>
            <span className="demo-mode-go">{t('demo.solo.action')}{Icons.arrow}</span>
          </button>
          <button type="button" className="demo-mode is-duo" onClick={() => chooseMode('duo')}>
            <span className="demo-icon-chip" aria-hidden="true">{Icons.duo}</span>
            <span className="demo-faces" aria-hidden="true"><img src={SAMPLES.you.src} alt="" loading="lazy" /><img src={SAMPLES.person.src} alt="" loading="lazy" /></span>
            <strong>{t('demo.duo.title')}</strong>
            <span className="demo-mode-text">{t('demo.duo.text')}</span>
            <span className="demo-mode-go">{t('demo.duo.action')}{Icons.arrow}</span>
          </button>
        </div>
        <p className="demo-footnote">{t('demo.footnote')}</p>
      </div>}

      {stage === 'shoot' && <div className="demo-shoot">
        <div className="demo-camera">
          <div ref={view} className={`demo-view is-${mode}`} aria-label={t('demo.viewLabel')} role="img">
            <div className="demo-pane"><img src={SAMPLES.you.src} alt="" style={{ objectPosition: `${SAMPLES.you.focus.x * 100}% ${SAMPLES.you.focus.y * 100}%` }} />{mode === 'duo' && <span className="demo-pane-label">{t('demo.you')}</span>}</div>
            {mode === 'duo' && <div className="demo-pane"><img src={SAMPLES.person.src} alt="" style={{ objectPosition: `${SAMPLES.person.focus.x * 100}% ${SAMPLES.person.focus.y * 100}%` }} /><span className="demo-pane-label">{t('demo.yourPerson')}</span></div>}
            <span className="demo-sample-badge"><i aria-hidden="true" />{t('demo.sampleBadge')}</span>
            <span className="demo-frame-guides" aria-hidden="true" />
            {countdown !== null && <div className="demo-countdown" aria-hidden="true" key={`count-${countdown}`}>{countdown}</div>}
            {shutter > 0 && <div key={`shutter-${shutter}`} className="shutter-flash" aria-hidden="true" />}
          </div>
          <ol className="demo-tray" aria-label={t('demo.trayLabel')}>
            {Array.from({ length: PHOTO_COUNT }, (_, i) => <li key={i} className={`${shots[i] ? 'filled' : ''} ${taking === i ? 'taking' : ''} is-${mode}`}>
              {shots[i]
                ? <button type="button" disabled={busy} onClick={() => void shoot(i)} aria-label={t('session.retakeN', { n: i + 1 })} title={t('session.retakeN', { n: i + 1 })}><img src={shots[i]} alt="" /><span className="demo-retake">{Icons.again}</span></button>
                : <span className="demo-slot-empty">{i + 1}</span>}
            </li>)}
          </ol>
        </div>

        <div className="demo-controls">
          <fieldset className="demo-field" disabled={busy}>
            <legend>{t('session.how')}</legend>
            <div className="demo-segmented">
              {(['timer', 'manual'] as const).map(value => <label key={value}><input type="radio" name="demo-method" checked={method === value} onChange={() => setMethod(value)} /><span>{value === 'timer' ? Icons.timer : Icons.tap}{t(value === 'timer' ? 'session.withTimer' : 'session.manual')}</span></label>)}
            </div>
          </fieldset>

          {method === 'timer' && <fieldset className="demo-field" disabled={busy}>
            <legend>{t('session.countdown')}</legend>
            <div className="demo-pills">
              {SECONDS.map(value => <label key={value}><input type="radio" name="demo-seconds" checked={seconds === value} onChange={() => setSeconds(value)} /><span>{t('session.seconds', { n: value })}</span></label>)}
            </div>
          </fieldset>}

          <div className="demo-flash">
            <div className="demo-flash-head">
              <span className="demo-icon-chip small" aria-hidden="true">{Icons.flash}</span>
              <div><strong>{t('session.flash')}</strong><p>{t('session.flashHelp')}</p></div>
              <button type="button" role="switch" className="demo-switch" aria-checked={flash} disabled={busy} onClick={() => setFlash(value => !value)}><span className="sr-only">{t('session.flashState', { state: t(flash ? 'common.on' : 'common.off') })}</span></button>
            </div>
            {flash && <fieldset className="demo-field demo-flash-colors" disabled={busy}>
              <legend>{t('session.flashColor')}</legend>
              <div className="demo-pills">
                {Object.entries(flashColors).map(([key, value]) => <label key={key}><input type="radio" name="demo-flash-color" checked={flashColor === key} onChange={() => setFlashColor(key as FlashColor)} /><span><i className="demo-dot" style={{ background: value.color }} aria-hidden="true" />{t(`flashColor.${key}` as Key)}</span></label>)}
              </div>
            </fieldset>}
          </div>

          <p className="demo-status" role="status" aria-live="polite">{status}</p>

          <div className="demo-actions">
            {busy && method === 'timer'
              ? <button type="button" className="demo-secondary" onClick={stop}>{t('session.stopCountdown')}</button>
              : complete
                ? <button type="button" className="primary" onClick={() => go('card')}>{t('demo.makeCard')}<span aria-hidden="true">{Icons.arrow}</span></button>
                : <button type="button" className="primary" disabled={busy} onClick={() => void shoot()}>{method === 'manual' ? t('session.takeOne') : filled ? t('session.continueCountdown') : t('session.startCountdown')}<span aria-hidden="true">{method === 'manual' ? Icons.camera : Icons.timer}</span></button>}
            <button type="button" className="text-button" disabled={busy} onClick={() => go('mode')}>{t('demo.changeMode')}</button>
          </div>
          {!complete && !busy && filled > 0 && <p className="demo-hint">{t('demo.retakeHint', { n: nextEmpty + 1 })}</p>}
        </div>
        <ScreenFlash active={flashLit} color={flashColor} view={view} />
      </div>}

      {stage === 'card' && <div className="demo-card">
        <div className="demo-card-preview" aria-busy={rendering}>
          {cardUrl && <img className={rendering ? 'is-updating' : ''} src={cardUrl} alt={t('demo.cardAlt')} />}
          {!cardUrl && !cardError && <div className="demo-developing"><span aria-hidden="true" />{t('demo.developing')}</div>}
          {cardError && <p className="demo-status" role="alert">{t('demo.cardError')}</p>}
        </div>

        <div className="demo-controls">
          <fieldset className="demo-field">
            <legend>{t('demo.frame')}</legend>
            <div className="demo-frames">
              {DESIGNS.map(key => <label key={key}><input type="radio" name="demo-design" checked={design === key} onChange={() => setDesign(key)} /><span><img src={thumbnailUrl(key)} alt="" loading="lazy" /><small>{cardDesigns[key].name}</small></span></label>)}
            </div>
          </fieldset>
          <fieldset className="demo-field">
            <legend>{t('demo.filter')}</legend>
            <div className="demo-pills">
              {FILTERS.map(key => <label key={key}><input type="radio" name="demo-filter" checked={filter === key} onChange={() => setFilter(key)} /><span>{t(`filter.${key}` as Key)}</span></label>)}
            </div>
          </fieldset>
          <p className="demo-card-note">{t('demo.cardNote')}</p>
          <div className="demo-actions">
            <a className="primary" href="#booth">{t('demo.makeYours')}<span aria-hidden="true">{Icons.arrow}</span></a>
            <button type="button" className="demo-secondary" disabled={!cardUrl || downloading} onClick={() => void download()}>{Icons.download}{t('demo.download')}</button>
          </div>
          <div className="demo-actions subtle">
            <button type="button" className="text-button" onClick={backToPhotos}>{t('demo.backToPhotos')}</button>
            <button type="button" className="text-button" onClick={startOver}>{t('demo.startOver')}</button>
          </div>
        </div>
      </div>}
    </div>
  </section>;
}
