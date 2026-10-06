import { WarningNotice } from '../components/WarningNotice';
import { useStepHistory } from '../components/useStepHistory';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LeaveDialog } from '../components/LeaveDialog';
import { layouts, move, replaceShot } from './core';
import { Instructions } from '../components/Instructions';
import { LayoutScreen } from './LayoutScreen';
import { BoothDialog } from '../components/BoothDialog';
import { createEditingConfirmation } from './editingConfirmation.mjs';
import { SessionScreen } from './SessionScreen';
import { SourceScreen } from './SourceScreen';
import { DuoUploadScreen } from './DuoUploadScreen';
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
import { useSessionCharge } from './useSessionCharge';
import './journey.css';
import { prefetchFrames } from './frameAssets';
import { reconcileOffsets } from './photoPosition.js';
import { useAuth } from '../auth/AuthProvider';
import { readDraft,saveDraft,deleteDraft } from './recoveryStore.js';

const progress: [Step, string][] = [['mode', 'Solo or duo'], ['source', 'Photo source'], ['layout', 'Your layout'], ['session', 'Your photos'], ['design', 'Frame & filter'], ['export', 'Export & download']];

export function Booth({ active, invite, leaveGuard }: { active: boolean; invite: string | null; leaveGuard: RefObject<(proceed: () => void) => void> }) {
  const party = useRoom();
  const charge = useSessionCharge();
  const {user}=useAuth();
  const [saveRecovery,setSaveRecovery]=useState(false),[savedDraft,setSavedDraft]=useState<any>(null),[recoveryMessage,setRecoveryMessage]=useState('');
  const [restored,setRestored]=useState(false);
  const recoveredGuest=useRef(false);
  const recoveryWrites=useRef(Promise.resolve());
  const duoControl = useRef<((event: DuoEvent) => Promise<void>) | null>(null);
  const [sharedError, setSharedError] = useState('');
  const [useInvite, setUseInvite] = useState(true);
  const [card, setCard] = useState<CardState>({ layout: 'A', shots: [], template: null, filter: 'original', color: 'cherry', caption: 'better together.', design: 'classic' });
  const [source, setSource] = useState<'camera' | 'upload'>('camera');
  const [mode, setMode] = useState<BoothMode>('solo');
  const [step, setStep] = useState<Step>('mode');
  useEffect(() => { if (active && (step === 'session' || step === 'upload')) return prefetchFrames(card.layout); }, [active, step, card.layout]);
  const [instructions, setInstructions] = useState(false);
  const [retake, setRetake] = useState<number | null>(null);
  const [method, setMethod] = useState<'manual' | 'timer'>('timer'), [seconds, setSeconds] = useState(3);
  const [restoreCamera, setRestoreCamera] = useState(false);
  const [flash, setFlash] = useState(false);
  const [flashColor, setFlashColor] = useState<FlashColor>('white');
  const [mirror, setMirror] = useState(true);
  const screen = useRef<HTMLDivElement>(null);
  const [duoUploads, setDuoUploads] = useState<string[]>([]);
  const hasPhotos = card.shots.some(Boolean) || duoUploads.some(Boolean);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [editingApproved, setEditingApproved] = useState(false);
  const [confirmation, setConfirmation] = useState({open:false,busy:false,error:''});
  const billing = useRef<() => Promise<void>>(async () => {});
  billing.current = async () => {
    if(party.room?.role==='guest')return;
    if(saveRecovery&&user){await persistRecovery(true);}
    await charge.complete(party.room?.code||null);
  };
  function persistRecovery(required=false){
    if(!user||!card.shots.length||!card.shots.every(Boolean))return Promise.resolve();
    const guest=party.room?.role==='guest'||restored&&recoveredGuest.current;
    if(guest&&!editingApproved)return Promise.resolve();
    const draft={card,source,mode,sessionId:charge.sessionId,guest};
    const task=recoveryWrites.current.catch(()=>{}).then(()=>saveDraft(user.id,draft));recoveryWrites.current=task;
    return task.then(()=>setRecoveryMessage('Recovery copy saved on this device for 24 hours.')).catch(()=>{setRecoveryMessage('This browser could not save recovery. Keep this tab open until you download.');if(required)throw new Error('Recovery could not be saved. Free some device storage or turn off recovery before continuing. No new charge was made.');});
  }
  useEffect(()=>{if(user)void readDraft(user.id).then(setSavedDraft).catch(()=>{});},[user?.id]);
  useEffect(()=>{if(saveRecovery&&hasPhotos)void persistRecovery();},[card,saveRecovery,editingApproved]);
  const editingGate = useRef<ReturnType<typeof createEditingConfirmation> | null>(null);
  if (!editingGate.current) editingGate.current = createEditingConfirmation(() => billing.current(), setConfirmation);
  useEffect(() => () => editingGate.current?.dispose(), []);
  const [peerConnected, setPeerConnected] = useState<boolean | null>(null), [explicitDisconnect, setExplicitDisconnect] = useState(false);
  const peerSeen = useRef(false), partnerSeen = useRef(false);
  const [disconnectAcknowledged, setDisconnectAcknowledged] = useState(false);
  useEffect(() => { peerSeen.current = false; partnerSeen.current = false; setPeerConnected(false); setExplicitDisconnect(false); setDisconnectAcknowledged(false); }, [party.room?.token]);
  const otherOnline = party.room ? party.room[party.room.role === 'host' ? 'guest' : 'host'].online : false;
  if (peerConnected) peerSeen.current = true;
  if (otherOnline) partnerSeen.current = true;
  const partnerLost = !!party.room && (explicitDisconnect || party.ended || peerSeen.current && peerConnected === false || partnerSeen.current && !otherOnline);
  useEffect(() => { if (peerConnected) setExplicitDisconnect(false); }, [peerConnected]);
  useEffect(() => { if (!partnerLost) setDisconnectAcknowledged(false); }, [partnerLost]);
  const disconnectOpen = active && partnerLost && !disconnectAcknowledged && !pendingLeave;
  const duoActive = !!party.room || mode === 'duo' && ['session','upload','design','export'].includes(step);
  function requestEditing() { return editingApproved || !!charge.receipt ? Promise.resolve(true) : editingGate.current!.request().then(Boolean); }
  function clearPhotos(removeSaved=true) {
    setRestored(false);
    if(removeSaved&&user){recoveryWrites.current=recoveryWrites.current.catch(()=>{}).then(()=>deleteDraft(user.id)).catch(()=>{setRecoveryMessage("Could not remove the recovery copy. Clear this site’s browser storage to remove it.");});setSavedDraft(null);setRecoveryMessage('');}
    editingGate.current?.cancel(); setConfirmation({open:false,busy:false,error:''}); setEditingApproved(false);
    charge.reset();
    setCard(current => ({ ...current, shots: [], offsets: [] }));
    setDuoUploads([]);
    setRetake(null); setRestoreCamera(false);
    document.getElementById('print-sheet')?.replaceChildren();
  }
  function requestLeave(proceed: () => void) {
    if (confirmation.busy) return;
    editingGate.current?.cancel();
    if (hasPhotos || duoActive) setPendingLeave(() => proceed);
    else { clearPhotos(); proceed(); }
  }
  function goBack(next: Step) {
    requestLeave(() => { if (party.room) { party.end(); setStep('duo'); } else setStep(next); });
  }
  useStepHistory<Step>('booth', active, step, (target, commit) => {
    if (confirmation.busy) return;
    if (target === 'export' || target === 'design') {
      if (editingApproved) commit();
      return;
    }
    if (['session','upload'].includes(target) && editingApproved) {
      if (party.room?.role === 'guest') return;
      if (party.room && source === 'camera') {
        void duoControl.current?.({type:'retake', index:null}).then(commit).catch(() => setSharedError('Reconnect your cameras before returning to your photos.'));
      } else commit();
      return;
    }
    requestLeave(() => { party.end(); commit(); });
  }, target => setStep(target === 'room' && !party.room ? 'duo' : target));
  useLayoutEffect(() => {
    leaveGuard.current = proceed => requestLeave(() => { party.end(); proceed(); });
    return () => { leaveGuard.current = proceed => proceed(); };
  });
  useEffect(() => {
    if ((!hasPhotos && !duoActive) || !active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPhotos, duoActive, active]);
  useEffect(() => {
    // Clear on actual page departure too, including pages restored from browser cache.
    const clearOnDeparture = () => { editingGate.current?.dispose(); clearPhotos(false); setPendingLeave(null); setStep('mode'); setInstructions(false); };
    window.addEventListener('pagehide', clearOnDeparture);
    return () => window.removeEventListener('pagehide', clearOnDeparture);
  }, []);
  useEffect(() => { if (active) { setUseInvite(true); setStep(invite ? 'join' : 'mode'); if (invite) setMode('duo'); setRetake(null); setRestoreCamera(false); setInstructions(!invite); } else { setInstructions(false); party.end(); } }, [active, invite]);
  // A missed heartbeat must not unmount the camera or silently send one user back.
  useEffect(() => { if (active && !instructions) { screen.current?.querySelector('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); } }, [step, active, instructions]);
  const change = (patch: Partial<CardState>) => setCard(current => ({ ...current, ...patch, ...(patch.shots ? { offsets: reconcileOffsets(current.shots, current.offsets, patch.shots) } : {}) }));
  async function reviewUploads(shots = card.shots) {
    change({shots});
    if (await requestEditing()) { change({ shots }); setEditingApproved(true); setRetake(null); setStep('design'); }
  }
  const reorder = (from: number, to: number) => {
    if (mode === 'duo' && source === 'upload') {
      const count = layouts[card.layout].count;
      setDuoUploads(current => [...move(current.slice(0, count), from, to), ...move(current.slice(count), from, to)]);
    }
    const apply = () => { setCard(current => { const shots = move(current.shots, from, to); const offsets = move(current.shots.map((_, i) => current.offsets?.[i] || { x: .5, y: .5 }), from, to); return { ...current, shots, offsets }; }); setRetake(null); };
    if (party.room?.role === 'host' && source === 'camera') {
      void duoControl.current?.({ type: 'move', from, to }).then(apply).catch(() => setSharedError('Reconnect your cameras before changing the shared photo order.'));
    } else apply();
  };
  async function retakeFromEdit(index: number | null) {
    if (party.room && source === 'camera') {
      if (party.room.role !== 'host' || !duoControl.current) return;
      try { await duoControl.current({ type: 'retake', index }); setSharedError(''); }
      catch { setSharedError('Your person is disconnected. Leave this booth and create a new session to retake together.'); return; }
    }
    setRetake(index); setStep(source === 'upload' ? 'upload' : 'session');
  }
  async function createParty() {
    const created = await party.create({ layout: card.layout, template: null, source });
    if (created) {
      try { await charge.reserve(created.code); setStep('room'); }
      catch { party.end(); }
    }
  }
  async function joinParty(code: string) {
    const joined = await party.join(code, useInvite ? invite : null);
    if (joined) { change({ layout: joined.settings.layout, template: null, shots: [] }); setSource(joined.settings.source); setMode('duo'); setStep('room'); }
  }
  useEffect(() => {
    if (!active || !invite) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const joined = await party.join('', invite);
      if (joined && !cancelled) { change({ layout: joined.settings.layout, template: null, shots: [] }); setSource(joined.settings.source); setMode('duo'); setStep('room'); }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active, invite]);
  async function enterParty() {
    const state = await party.check();
    if (state?.bothReady) {
      try { if (party.room?.role === 'host') await charge.reserve(party.room.code); setStep(source === 'upload' ? 'upload' : 'session'); } catch { /* Keep the authorization error visible. */ }
    }
  }
  async function startSession() {
    if (charge.busy || party.busy) return;
    setRestoreCamera(false);
    if (mode === 'duo' && source === 'camera') { await createParty(); return; }
    try { await charge.reserve(); setStep(source === 'upload' ? 'upload' : 'session'); } catch { /* Keep the layout and show the error. */ }
  }
  const visibleProgress: [Step, string][] = mode === 'duo' && ['duo', 'join', 'room'].includes(step) ? [['duo', 'Create or join'], ['join', 'Invitation'], ['room', 'Your party']] : progress;
  return <>
    <section id="booth" className="booth flow-booth" hidden={!active} aria-label="Photobooth">
      <div className="flow-top"><a href="#" className="back-link">Leave the booth</a><button className="text-button" id="show-instructions" onClick={() => setInstructions(true)}>How it works</button></div>
      <ol className="flow-steps" aria-label="Your photobooth progress">{visibleProgress.map(([key, label], index) => <li key={key} data-step={key} className={(step === key || (step === 'upload' && key === 'session')) ? 'current' : ''} aria-current={(step === key || (step === 'upload' && key === 'session')) ? 'step' : undefined}>0{index + 1} <span>{label}</span></li>)}</ol>
      <div id="flow-screen" ref={screen}>
        {active&&savedDraft&&<div className="session-note"><p>A previous photocard is saved on this device.</p><button className="primary" onClick={async()=>{try{if(!savedDraft.guest)await charge.resume(savedDraft.sessionId);recoveredGuest.current=!!savedDraft.guest;setRestored(true);setCard(savedDraft.card);setSource(savedDraft.source);setMode(savedDraft.mode);setEditingApproved(true);setStep('design');setInstructions(false);setSaveRecovery(true);setSavedDraft(null);}catch(e){setSharedError(e instanceof Error?e.message:'Could not resume.');}}}>Resume saved editing</button><button className="text-button" onClick={()=>{if(user)void deleteDraft(user.id).catch(()=>setSharedError("Could not delete the saved copy. Please try again."));setSavedDraft(null);}}>Delete saved copy</button><WarningNotice>{sharedError}</WarningNotice></div>}
        {active&&['session','upload','design','export'].includes(step)&&<div className="session-note"><label><input type="checkbox" checked={saveRecovery} onChange={e=>{setSaveRecovery(e.target.checked);if(!e.target.checked&&user){recoveryWrites.current=recoveryWrites.current.catch(()=>{}).then(()=>deleteDraft(user.id)).catch(()=>{setRecoveryMessage("Could not remove the recovery copy. Clear this site’s browser storage to remove it.");});setRecoveryMessage('Saved copy removed.');}}}/> Save recovery on this device for 24 hours</label><p>Optional. Photos stay on this device. Explicitly leaving the booth deletes the saved copy. Expired copies are removed when you return.</p><p role="status">{recoveryMessage}</p></div>}
        {active && !confirmation.open && charge.error && <WarningNotice title="Before you continue"><p>{charge.error}</p><a href="#account/buy" target="_blank" rel="noopener noreferrer">Open account & top up</a><p>Your photos stay here while you check your account.</p></WarningNotice>}
        {active && ['session','upload','design','export'].includes(step) && <div className="session-note" aria-live="polite">
          {party.room?.role === 'guest' ? 'Your creator covers this session. No points or free trial are used from your account.' : charge.busy ? 'Confirming your session…' : charge.receipt || 'Nothing is deducted until you confirm that you’re ready to edit. Your free trial is used first, otherwise 100 points.'}
        </div>}
        {active && step === 'mode' && <ModeScreen onChoose={choice => { setMode(choice); clearPhotos(); change({template:null}); setStep('source'); }} />}
        {active && step === 'duo' && <DuoChoice onCreate={() => { party.end(); setStep('layout'); }} onJoin={() => { party.end(); setUseInvite(false); setStep('join'); }} onBack={() => setStep('source')} />}
        {active && step === 'join' && <JoinRoom invite={useInvite ? invite : null} busy={party.busy} error={party.error} onJoin={joinParty} onBack={() => { party.end(); setStep('duo'); }} />}
        {active && step === 'room' && party.room && <WaitingRoom room={party.room} busy={party.busy} error={party.error} onReady={value => { void party.ready(value); }} onContinue={enterParty} onLeave={() => requestLeave(() => { party.end(); setStep('duo'); })} />}
        {active && step === 'layout' && <><LayoutScreen busy={party.busy || charge.busy} selected={card.layout} onSelect={layout => { if (layout !== card.layout) change({ layout, shots: [], template: null }); setRetake(null); }} onBack={() => setStep(mode === 'duo' && source === 'camera' ? 'duo' : 'source')} onNext={() => void startSession()} /><WarningNotice>{party.error}</WarningNotice></>}
        {active && step === 'source' && <SourceScreen mode={mode} onBack={() => setStep('mode')} onChoose={choice => { change({ shots: [], template: null }); setSource(choice); setRetake(null); setStep(mode === 'duo' && choice === 'camera' ? 'duo' : 'layout'); }} />}
        {active && (step === 'session' || ['design','export'].includes(step) && party.room && source === 'camera') && <div hidden={step !== 'session'}><SessionScreen room={party.room} visible={step === 'session'} duoControl={duoControl} onPartnerConnection={setPeerConnected} onPartnerExit={() => setExplicitDisconnect(true)} onSharedPhotos={shots => change({ shots })} onRemoteSession={index => { setRetake(index); setStep('session'); }} card={card} method={method} seconds={seconds} onMethod={setMethod} onSeconds={setSeconds} retake={retake} onRetake={setRetake} restoreCamera={restoreCamera} interrupted={instructions || !!pendingLeave || confirmation.open || disconnectOpen} flash={flash} flashColor={flashColor} onFlashChange={setFlash} onFlashColor={setFlashColor} mirror={mirror} onMirrorChange={setMirror}
          beforeReview={requestEditing} onShot={(index, shot) => setCard(current => ({ ...current, shots: replaceShot(current.shots, index, shot), offsets: reconcileOffsets(current.shots, current.offsets, replaceShot(current.shots, index, shot)) }))} onMove={reorder} onBack={() => goBack('layout')} onNext={wasCamera => { setRestoreCamera(wasCamera); setRetake(null); setEditingApproved(true); setStep('design'); }} /></div>}
        {active && step === 'upload' && mode === 'solo' && <UploadScreen card={card} replacement={retake} onPhotos={shots => { change({ shots }); setRetake(null); }} onMove={reorder} onBack={() => goBack('layout')} onNext={() => void reviewUploads()} />}
        {active && step === 'upload' && mode === 'duo' && <DuoUploadScreen card={card} photos={duoUploads} onPhotos={setDuoUploads} onBack={() => goBack('layout')} onNext={shots => void reviewUploads(shots)} />}
        {active && editingApproved && (step === 'design' || step === 'export') && <><EditScreen stage={step} onContinue={() => setStep('export')} photosLocked={restored || party.room?.role === 'guest' && source === 'camera'} source={source} card={card} onChange={change} onMove={reorder} onRetake={index => { void retakeFromEdit(index); }} onBack={() => void retakeFromEdit(null)} onDesign={() => setStep('design')} /><WarningNotice>{sharedError}</WarningNotice></>}
      </div>
    </section>
    <Instructions open={active && !savedDraft && instructions && !disconnectOpen && !pendingLeave && !confirmation.open} onDismiss={() => setInstructions(false)} onContinue={() => setInstructions(false)} />
    <div id="print-sheet" aria-hidden="true" />
    <LeaveDialog duo={duoActive} open={!!pendingLeave} count={duoUploads.some(Boolean) ? duoUploads.filter(Boolean).length : card.shots.filter(Boolean).length} onCancel={() => setPendingLeave(null)} onConfirm={() => { const proceed = pendingLeave; setPendingLeave(null); void duoControl.current?.({type:'leave'}).catch(() => {}); clearPhotos(); proceed?.(); }} />
    <BoothDialog open={active && confirmation.open && !disconnectOpen && !pendingLeave} title="Proceed to Editing?" cancelLabel="Retake / Cancel" confirmLabel={charge.cost === 0 ? 'Confirm & Use Free Trial' : 'Confirm & Deduct Points'} busy={confirmation.busy} error={confirmation.error} onCancel={() => editingGate.current?.cancel()} onConfirm={() => void editingGate.current?.confirm()}>
      <p>Review your photos carefully. Once you continue to framing and export, {charge.cost === 0 ? 'your free trial will be used and 0 points will be deducted from your account.' : `${charge.cost ?? 100} points will be deducted from your account.`}</p>
    </BoothDialog>
    <BoothDialog open={disconnectOpen} title="Partner Disconnected" cancelLabel="Stay in Room" confirmLabel="Leave Booth" busy={confirmation.busy} onCancel={() => { setDisconnectAcknowledged(true); void party.check(); }} onConfirm={() => { editingGate.current?.cancel(); clearPhotos(); party.end(); setStep('mode'); }}>
      <p>Your partner has left the session. Would you like to stay in the room or leave?</p>
    </BoothDialog>
  </>;
}
