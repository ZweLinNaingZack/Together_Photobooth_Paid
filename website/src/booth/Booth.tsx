import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LeaveDialog } from '../components/LeaveDialog';
import { move, replaceShot } from './core';
import { Instructions } from '../components/Instructions';
import { LayoutScreen } from './LayoutScreen';
import { DesignScreen } from './DesignScreen';
import { SessionScreen } from './SessionScreen';
import { SourceScreen } from './SourceScreen';
import { UploadScreen } from './UploadScreen';
import { EditScreen } from './EditScreen';
import { ModeScreen } from './ModeScreen';
import type { BoothMode } from './ModeScreen';
import type { CardState, Step } from './types';
import type { FlashColor } from './ScreenFlash';
import { DuoChoice } from './DuoChoice';
import { JoinRoom } from './JoinRoom';
import { WaitingRoom } from './WaitingRoom';
import { useRoom } from './useRoom';
import type { DuoEvent } from './useDuoPeer';

const progress: [Step, string][] = [['mode', 'Solo or duo'], ['layout', 'Your layout'], ['source', 'Your photos'], ['design', 'Your design'], ['session', 'Your moment'], ['edit', 'Review & export']];

export function Booth({ active, invite, leaveGuard }: { active: boolean; invite: string | null; leaveGuard: RefObject<(proceed: () => void) => void> }) {
  const party = useRoom();
  const duoControl = useRef<((event: DuoEvent) => Promise<void>) | null>(null);
  const [sharedError, setSharedError] = useState('');
  const [useInvite, setUseInvite] = useState(true);
  const [card, setCard] = useState<CardState>({ layout: 'A', shots: [], template: null, filter: 'original', color: 'cherry', caption: 'better together.', design: 'classic' });
  const [source, setSource] = useState<'camera' | 'upload'>('camera');
  const [mode, setMode] = useState<BoothMode>('solo');
  const [step, setStep] = useState<Step>('mode');
  const [instructions, setInstructions] = useState(false);
  const [retake, setRetake] = useState<number | null>(null);
  const [method, setMethod] = useState<'manual' | 'timer'>('timer'), [seconds, setSeconds] = useState(3);
  const [restoreCamera, setRestoreCamera] = useState(false);
  const [flash, setFlash] = useState(false);
  const [flashColor, setFlashColor] = useState<FlashColor>('white');
  const [mirror, setMirror] = useState(true);
  const screen = useRef<HTMLDivElement>(null);
  const hasPhotos = card.shots.some(Boolean);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  function clearPhotos() {
    setCard(current => ({ ...current, shots: [] }));
    setRetake(null); setRestoreCamera(false);
    document.getElementById('print-sheet')?.replaceChildren();
  }
  function requestLeave(proceed: () => void) {
    if (hasPhotos) setPendingLeave(() => proceed);
    else { clearPhotos(); proceed(); }
  }
  function goBack(next: Step) {
    requestLeave(() => { if (party.room) { party.end(); setStep('duo'); } else setStep(next); });
  }
  useLayoutEffect(() => {
    leaveGuard.current = proceed => requestLeave(() => { party.end(); proceed(); });
    return () => { leaveGuard.current = proceed => proceed(); };
  });
  useEffect(() => {
    if (!hasPhotos || !active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPhotos, active]);
  useEffect(() => {
    // Clear on actual page departure too, including pages restored from browser cache.
    const clearOnDeparture = () => { clearPhotos(); setPendingLeave(null); setStep('mode'); setInstructions(false); };
    window.addEventListener('pagehide', clearOnDeparture);
    return () => window.removeEventListener('pagehide', clearOnDeparture);
  }, []);
  useEffect(() => { if (active) { setUseInvite(true); setStep(invite ? 'join' : 'mode'); if (invite) setMode('duo'); setRetake(null); setRestoreCamera(false); setInstructions(!invite); } else { setInstructions(false); party.end(); } }, [active, invite]);
  useEffect(() => { if (party.room && !party.room.bothReady && (step === 'session' || step === 'upload')) setStep('room'); }, [party.room?.bothReady, step]);
  useEffect(() => { if (active && !instructions) { screen.current?.querySelector('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); } }, [step, active, instructions]);
  const change = (patch: Partial<CardState>) => setCard(current => ({ ...current, ...patch }));
  const reorder = (from: number, to: number) => {
    const apply = () => { setCard(current => ({ ...current, shots: move(current.shots, from, to) })); setRetake(null); };
    if (party.room?.role === 'host' && source === 'camera') {
      void duoControl.current?.({ type: 'move', from, to }).then(apply).catch(() => setSharedError('Reconnect your cameras before changing the shared photo order.'));
    } else apply();
  };
  async function retakeFromEdit(index: number) {
    if (party.room && source === 'camera') {
      if (party.room.role !== 'host' || !duoControl.current) return;
      try { await duoControl.current({ type: 'retake', index }); setSharedError(''); }
      catch { setSharedError('Your person is disconnected. Leave this booth and create a new session to retake together.'); return; }
    }
    setRetake(index); setStep(source === 'upload' ? 'upload' : 'session');
  }
  async function createParty() {
    const created = await party.create({ layout: card.layout, template: card.template, source });
    if (created) setStep('room');
  }
  async function joinParty(code: string) {
    const joined = await party.join(code, useInvite ? invite : null);
    if (joined) { change({ layout: joined.settings.layout, template: joined.settings.template, shots: [] }); setSource(joined.settings.source); setMode('duo'); setStep('room'); }
  }
  async function enterParty() {
    const state = await party.check();
    if (state?.bothReady) setStep(source === 'upload' ? 'upload' : 'session');
  }
  const visibleProgress: [Step, string][] = mode === 'duo' && ['duo', 'join', 'room'].includes(step) ? [['duo', 'Create or join'], ['join', 'Invitation'], ['room', 'Your party']] : progress;
  return <>
    <section id="booth" className="booth flow-booth" hidden={!active} aria-label="Photobooth">
      <div className="flow-top"><a href="#" className="back-link">Leave the booth</a><button className="text-button" id="show-instructions" onClick={() => setInstructions(true)}>How it works</button></div>
      <ol className="flow-steps" aria-label="Your photobooth progress">{visibleProgress.map(([key, label], index) => <li key={key} data-step={key} className={(step === key || (step === 'upload' && key === 'session')) ? 'current' : ''} aria-current={(step === key || (step === 'upload' && key === 'session')) ? 'step' : undefined}>0{index + 1} <span>{label}</span></li>)}</ol>
      <div id="flow-screen" ref={screen}>
        {active && step === 'mode' && <ModeScreen onChoose={choice => { setMode(choice); clearPhotos(); setStep(choice === 'duo' ? 'duo' : 'layout'); }} />}
        {active && step === 'duo' && <DuoChoice onCreate={() => { party.end(); setStep('layout'); }} onJoin={() => { party.end(); setUseInvite(false); setStep('join'); }} onBack={() => setStep('mode')} />}
        {active && step === 'join' && <JoinRoom invite={useInvite ? invite : null} busy={party.busy} error={party.error} onJoin={joinParty} onBack={() => { party.end(); setStep('duo'); }} />}
        {active && step === 'room' && party.room && <WaitingRoom room={party.room} busy={party.busy} error={party.error} onReady={value => { void party.ready(value); }} onContinue={enterParty} onLeave={() => requestLeave(() => { party.end(); setStep('duo'); })} />}
        {active && step === 'layout' && <LayoutScreen selected={card.layout} onSelect={layout => { if (layout !== card.layout) change({ layout, shots: [], template: null }); setRetake(null); }} onBack={() => setStep(mode === 'duo' ? 'duo' : 'mode')} onNext={() => setStep('source')} />}
        {active && step === 'source' && <SourceScreen mode={mode} onBack={() => setStep('layout')} onChoose={choice => { if (choice !== source) change({ shots: [] }); setSource(choice); setRetake(null); setStep('design'); }} />}
        {active && step === 'design' && <><DesignScreen busy={party.busy} card={card} onSelect={template => change({ template })} onBack={() => { party.end(); setStep('source'); }} nextLabel={party.busy ? 'Creating your booth…' : mode === 'duo' ? 'Create invitation' : source === 'upload' ? 'Choose your photos' : 'Take the photos now'} onNext={() => { setRestoreCamera(false); if (mode === 'duo') void createParty(); else setStep(source === 'upload' ? 'upload' : 'session'); }} /><p className="room-error" role="alert">{party.error}</p></>}
        {active && (step === 'session' || step === 'edit' && party.room && source === 'camera') && <div hidden={step !== 'session'}><SessionScreen room={party.room} visible={step === 'session'} duoControl={duoControl} onSharedPhotos={shots => change({ shots })} onRemoteSession={index => { setRetake(index); setStep('session'); }} card={card} method={method} seconds={seconds} onMethod={setMethod} onSeconds={setSeconds} retake={retake} onRetake={setRetake} restoreCamera={restoreCamera} interrupted={instructions || !!pendingLeave} flash={flash} flashColor={flashColor} onFlashChange={setFlash} onFlashColor={setFlashColor} mirror={mirror} onMirrorChange={setMirror}
          onShot={(index, shot) => setCard(current => ({ ...current, shots: replaceShot(current.shots, index, shot) }))} onMove={reorder} onBack={() => goBack('design')} onNext={wasCamera => { setRestoreCamera(wasCamera); setRetake(null); setStep('edit'); }} /></div>}
        {active && step === 'upload' && <UploadScreen card={card} replacement={retake} onPhotos={shots => { change({ shots }); setRetake(null); }} onMove={reorder} onBack={() => goBack('design')} onNext={() => setStep('edit')} />}
        {active && step === 'edit' && <><EditScreen photosLocked={party.room?.role === 'guest' && source === 'camera'} source={source} card={card} onChange={change} onMove={reorder} onRetake={index => { void retakeFromEdit(index); }} onBack={() => goBack(source === 'upload' ? 'upload' : 'session')} onDesign={() => goBack('design')} /><p className="room-error" role="alert">{sharedError}</p></>}
      </div>
    </section>
    <Instructions open={active && instructions} onDismiss={() => { setInstructions(false); if (step === 'layout') window.location.hash = ''; }} onContinue={() => setInstructions(false)} />
    <div id="print-sheet" aria-hidden="true" />
    <LeaveDialog open={!!pendingLeave} count={card.shots.filter(Boolean).length} onCancel={() => setPendingLeave(null)} onConfirm={() => { const proceed = pendingLeave; setPendingLeave(null); clearPhotos(); proceed?.(); }} />
  </>;
}
