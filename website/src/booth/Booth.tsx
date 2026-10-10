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
import type { SavedRoom } from './useRoom';
import { RoomRequestError } from './rooms';
import type { DuoEvent } from './useDuoPeer';
import { useSessionCharge } from './useSessionCharge';
import { ActiveBoothDialog } from './ActiveBoothDialog';
import type { ActiveBoothInfo } from './ActiveBoothDialog';
import type { ActiveReservation } from './useSessionCharge';
import './journey.css';
import { prefetchFrames } from './frameAssets';
import { reconcileOffsets } from './photoPosition.js';
import { useAuth } from '../auth/AuthProvider';
import { readDraft,saveDraft,deleteDraft,readActiveSession,saveActiveSession,deleteActiveSession } from './recoveryStore.js';
import { formatTime, tm, useT } from '../i18n';

/**
 * A "Your photos" session saved on this device before editing is confirmed.
 * - Solo:        step 'session' (camera) or 'upload'
 * - Duo room:    step 'room' (waiting) or 'session' (live cameras), with this person's room credentials
 * - Duo upload:  step 'upload', photos for both sides in duoUploads
 * Guests have no reservation (sessionId is ''), because only the host pays.
 */
interface ActiveRecord { sessionId: string; mode: BoothMode; source: 'camera' | 'upload'; step: 'session' | 'upload' | 'room'; card: CardState; photosSaved: boolean; room?: SavedRoom; duoUploads?: string[]; savedAt?: number }
/** An unfinished session the user can resume or close. `local` is set when this device also has it saved. */
type SessionConflict = Pick<ActiveReservation, 'sessionId' | 'duo' | 'expiresAt' | 'createdAt'> & { local: ActiveRecord | null; roomEnded?: boolean; error?: string;
  /** 'start': a new booth was refused because of this one, so closing it continues straight into the new booth. */
  origin?: 'load' | 'start' };
/** Turn an unfinished session into what the popup shows. */
function boothInfo(conflict: SessionConflict): ActiveBoothInfo {
  const record = conflict.local, guest = record?.room?.role === 'guest';
  const heldUntil = conflict.expiresAt ? shortTime(conflict.expiresAt) : undefined;
  if (!record) return { kind: conflict.duo ? 'duo-unknown' : 'solo-unknown', heldUntil, ended: !!conflict.roomEnded, guest: false, hasSavedPhotos: false };
  const count = layouts[record.card.layout].count;
  const kind: ActiveBoothInfo['kind'] = record.room ? (guest ? 'duo-guest' : 'duo-host') : record.mode === 'duo' ? 'duo-upload' : record.source === 'upload' ? 'solo-upload' : 'solo-camera';
  const photos = record.mode === 'duo' && !record.room ? (record.duoUploads || []).slice(0, count) : Array.from(record.card.shots, shot => shot || '');
  const saved = kind === 'duo-upload' ? (record.duoUploads || []).filter(Boolean).length : record.card.shots.filter(Boolean).length;
  // Photos only count as "saved here" when auto-save was on; guests get theirs back from the host.
  const total = record.photosSaved && kind !== 'duo-guest' ? (kind === 'duo-upload' ? count * 2 : count) : undefined;
  return { kind, card: record.card, photos, saved, total, roomCode: record.room?.code, heldUntil,
    lastSaved: record.savedAt ? shortTime(record.savedAt) : undefined, ended: !!conflict.roomEnded, guest, hasSavedPhotos: !!total && saved > 0 };
}
const roomGone = (error: unknown) => error instanceof RoomRequestError && (error.status === 403 || error.status === 404);
const shortTime = (value?: string | number) => value ? formatTime(value) : '';
const needsPoints = (message?: string) => !!message && /points|top up/i.test(message);

export function Booth({ active, invite, leaveGuard }: { active: boolean; invite: string | null; leaveGuard: RefObject<(proceed: () => void) => void> }) {
  const activeSaved=useRef(false);          // true once this tab's active session is stored on the device
  const party = useRoom(activeSaved);        // a saved session keeps its room open across a refresh
  const charge = useSessionCharge();
  const t = useT();
  const {user}=useAuth();
  const [saveRecovery,setSaveRecovery]=useState(true),[savedDraft,setSavedDraft]=useState<any>(null),[recoveryMessage,setRecoveryMessage]=useState('');
  const [restored,setRestored]=useState(false);
  const recoveredGuest=useRef(false);
  const recoveryWrites=useRef(Promise.resolve());
  // Unfinished-session recovery (before editing is confirmed).
  const [conflict,setConflict]=useState<SessionConflict|null>(null);
  const [resuming,setResuming]=useState(false);
  const [closing,setClosing]=useState(false);
  const [checkingConflict,setCheckingConflict]=useState(false);   // looking up the old booth after a refusal
  const [recheck,setRecheck]=useState(0);   // bumped when the page comes back from the browser's back/forward cache
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
    const draft={card,source,mode,sessionId:charge.sessionId,guest,step:step==='export'?'export':'design',editingApproved};
    const task=recoveryWrites.current.catch(()=>{}).then(()=>saveDraft(user.id,draft));recoveryWrites.current=task;
    return task.then(()=>setRecoveryMessage(t('booth.recoverySaved'))).catch(()=>{setRecoveryMessage(t('booth.recoveryFailed'));if(required)throw new Error(t('booth.recoveryRequired'));});
  }
  // Put a saved "Your photos" session back on screen (after its reservation/room was reattached).
  function applyRecord(record: ActiveRecord, step: Step = record.step) {
    recoveredGuest.current=false; setRestored(false);
    setMode(record.mode); setSource(record.source);
    setCard(current=>({...current,...record.card}));
    setDuoUploads(record.duoUploads||[]);
    setSaveRecovery(record.photosSaved); setEditingApproved(false);
    setRetake(null); setRestoreCamera(false); setInstructions(false); setConflict(null);
    setStep(step);
    const welcome = t(record.room ? 'booth.welcomeDuo' : 'booth.welcomeSolo');
    setRecoveryMessage(`${welcome} ${t(record.photosSaved ? 'booth.photosKept' : 'booth.autosaveWasOff')}`);
  }
  /**
   * Reattach everything a saved session needs, then show it.
   * Duo room: reconnect to the room first (proves it still exists), then the host
   * re-holds the same reservation for that room. Guests are never billed.
   * Throws if the room has ended (see roomGone) or the reservation cannot be held.
   */
  async function resumeRecord(record: ActiveRecord) {
    if (record.room) {
      const room = await party.resume(record.room);
      if (record.room.role === 'host') {
        // If this fails, the room stays connected so "Start a new session" can close it properly.
        await charge.adopt(record.sessionId, room.code);
      }
      // Go back to live cameras only if the partner is still there; otherwise wait in the room for them.
      applyRecord({ ...record, card: { ...record.card, layout: room.settings.layout } }, record.step === 'session' && room.guest.online && room.host.online ? 'session' : 'room');
      return;
    }
    await charge.adopt(record.sessionId);   // same reservation id: no new booth, no charge
    applyRecord(record);
  }
  // Decide what to show when a saved session could not be reattached automatically.
  function resumeFailed(record: ActiveRecord, error: unknown) {
    charge.clearError();
    const ended = !!record.room && roomGone(error);
    if (ended && record.room?.role === 'guest') {
      // Nothing to keep: the guest has no reservation and the room is gone.
      if (user) recoveryWrites.current = recoveryWrites.current.catch(()=>{}).then(()=>deleteActiveSession(user.id)).catch(()=>{});
      activeSaved.current = false; setConflict(null); setStep('mode');
      setRecoveryMessage(t('booth.duoEnded'));
      return;
    }
    setConflict(current => ({ origin: current?.origin || 'load', sessionId: record.sessionId, duo: record.mode === 'duo', local: record, roomEnded: ended,
      error: ended ? undefined : error instanceof Error ? error.message : t('booth.reopenFailed') }));
  }
  // On opening the booth, restore in this order (only one of these exists at a time):
  //   1. a paid editing draft            → Frame & filter / Export   (existing behaviour)
  //   2. an unconfirmed session on device → Your photos / duo room, same reservation
  //   3. a reservation only the server knows about → "Resume existing session" panel
  useEffect(()=>{
    if(!user||!active||invite)return;   // invite links are handled by the join effect below
    let cancelled=false;
    void (async()=>{
      let draft:any=null;
      try{draft=await readDraft(user.id);}catch{/* storage unavailable: fall through */}
      if(cancelled)return;
      let record:ActiveRecord|null=null;
      try{record=await readActiveSession(user.id);}catch{/* storage unavailable */}
      if(cancelled)return;
      // A full set of photos is also backed up as an unconfirmed editing draft. While the
      // session is still in "Your photos", the active session record is the one to restore.
      if(draft&&!draft.editingApproved&&record)draft=null;
      if(draft){
        setSavedDraft(draft);
        // Older opt-in drafts and pre-payment backups remain manually resumable.
        if(!draft.editingApproved)return;
        try{if(!draft.guest)await charge.resume(draft.sessionId);}
        catch{if(!cancelled)setSharedError(t('booth.restoreFailed'));return;}
        if(cancelled)return;
        recoveredGuest.current=!!draft.guest;setRestored(true);setCard(draft.card);
        setSource(draft.source);setMode(draft.mode);setEditingApproved(true);
        setStep(draft.step==='export'?'export':'design');setInstructions(false);setSavedDraft(null);
        return;
      }
      if(record){
        activeSaved.current=true;   // it is saved: another refresh must keep its room and reservation too
        try{await resumeRecord(record);}
        catch(e){if(!cancelled)resumeFailed(record,e);}
        return;
      }
      const found=await lookUpUnfinished();
      if(!cancelled&&found)setConflict({...found,origin:'load'});
    })();
    return()=>{cancelled=true;};
  },[user?.id,active,invite,recheck]);
  useEffect(()=>{if(saveRecovery&&hasPhotos)void persistRecovery();},[card,saveRecovery,editingApproved,step]);
  // Save the unfinished session on this device while it is in progress.
  // With auto-save off we still keep the session id, room and step (no photos) so it can be resumed or closed.
  const savingSolo=mode==='solo'&&!party.room&&(step==='session'||step==='upload');
  const savingDuoRoom=mode==='duo'&&source==='camera'&&!!party.room&&(step==='room'||step==='session');
  const savingDuoUpload=mode==='duo'&&source==='upload'&&!party.room&&step==='upload';
  const activeSessionOpen=active&&!!user&&!editingApproved&&(savingSolo||savingDuoRoom||savingDuoUpload);
  const roomKey=party.room?.token;   // the room object changes every heartbeat; only a new room should trigger a save
  useEffect(()=>{
    if(!activeSessionOpen||!user)return;
    const room=party.room;
    const savedRoom:SavedRoom|undefined=room?{code:room.code,token:room.token,role:room.role,
      // Hosts keep the invite to share again; guests keep the link they joined with, so a refresh reconnects instead of re-joining.
      ...(room.role==='host'&&room.invite?{invite:room.invite}:room.role==='guest'&&useInvite&&invite?{invite}:{})}:undefined;
    const record:ActiveRecord={sessionId:room?.role==='guest'?'':charge.sessionId,mode,source,
      step:savingDuoRoom?(step==='session'?'session':'room'):source==='upload'?'upload':'session',
      card:saveRecovery?card:{...card,shots:[],offsets:[]},photosSaved:saveRecovery,
      ...(savedRoom?{room:savedRoom}:{}),...(savingDuoUpload?{duoUploads:saveRecovery?duoUploads:[]}:{})};
    const task=recoveryWrites.current.catch(()=>{}).then(()=>saveActiveSession(user.id,record));
    recoveryWrites.current=task;
    task.then(()=>{activeSaved.current=true;},()=>setRecoveryMessage(t('booth.sessionSaveFailed')));
  },[activeSessionOpen,card,duoUploads,source,step,saveRecovery,charge.sessionId,roomKey]);
  // Once editing is confirmed, the editing draft takes over, so the pre-edit record is removed.
  useEffect(()=>{
    if(!editingApproved||!user)return;
    activeSaved.current=false;
    recoveryWrites.current=recoveryWrites.current.catch(()=>{}).then(()=>deleteActiveSession(user.id)).catch(()=>{});
  },[editingApproved,user?.id]);
  async function resumeConflict(){
    if(!conflict||resuming||conflict.roomEnded)return;
    setResuming(true);
    try{
      if(conflict.local)await resumeRecord(conflict.local);
      else{
        await charge.adopt(conflict.sessionId);
        // Photos for this session are not on this device: keep the held booth and continue from photo source.
        setCard(current=>({...current,shots:[],offsets:[],template:null}));
        setMode('solo');setRetake(null);setInstructions(false);setConflict(null);setStep('source');
        setRecoveryMessage(t('booth.stillHeld'));
      }
    }catch(e){
      if(conflict.local){resumeFailed(conflict.local,e);}
      else{charge.clearError();setConflict(current=>current&&{...current,error:e instanceof Error?e.message:t('booth.resumeFailed')});}
    }finally{setResuming(false);}
  }
  async function startNewSession(){
    if(!conflict||closing)return;
    const continueNew=conflict.origin==='start';
    setClosing(true);
    try{
      // Only unconfirmed holds can be released; nothing was charged. Guests have no hold to release.
      if(conflict.sessionId)await charge.release(conflict.sessionId);
      clearPhotos();                              // also removes any saved copy on this device
      party.end();                                // leave a reconnected room, if any
      setConflict(null);setInstructions(false);
      if(continueNew){
        // The user was starting a new booth when the old one blocked it: carry straight on.
        setRecoveryMessage(t('booth.closedStarting'));
        void startSession();
      }else{
        setStep('mode');
        setRecoveryMessage(t('booth.closedNew'));
      }
    }catch(e){setConflict(current=>current&&{...current,error:e instanceof Error?e.message:t('booth.closeFailed')});}
    finally{setClosing(false);}
  }
  /**
   * Find an unfinished booth this device does not know about (cleared storage, another device):
   * the server reservation (migration 019) plus, for duo, this account's open room seat.
   */
  async function lookUpUnfinished():Promise<SessionConflict|null>{
    const [server,seat]=await Promise.all([charge.findActive().catch(()=>null),party.findMine().catch(()=>null)]);
    const blank={...card,shots:[],offsets:[],template:null};
    const seatRecord=(sessionId:string,room:SavedRoom):ActiveRecord=>({sessionId,mode:'duo',source:'camera',step:'room',card:blank,photosSaved:false,room});
    if(server&&!server.duo)return{...server,local:null};
    // A duo hold with our host seat still open can be reopened; without the room it can only be released.
    if(server?.duo)return seat?.role==='host'?{...server,local:seatRecord(server.sessionId,seat)}:{...server,local:null,roomEnded:true};
    // Guests have no hold (only the host pays), but their seat may still be open.
    if(seat?.role==='guest')return{sessionId:'',duo:true,local:seatRecord('',seat)};
    return null;
  }
  // A new booth was refused because one already exists: offer that one instead of a dead-end message.
  async function offerExistingSession(error:unknown){
    if(!(error instanceof Error)||!/active booth/i.test(error.message))return;
    setCheckingConflict(true);
    try{
      let local:ActiveRecord|null=null;
      try{local=user?await readActiveSession(user.id):null;}catch{/* ignore */}
      const found=await lookUpUnfinished();
      if(!found)return;   // lookup unavailable: the fallback message explains what to do
      // Prefer this device's own copy (it has the photos) when it is the same booth.
      if(local&&(local.sessionId===found.sessionId||found.local?.room&&local.room?.token===found.local.room.token))found.local=local;
      charge.clearError();setConflict({...found,origin:'start'});
    }finally{setCheckingConflict(false);}
  }
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
  // removeSaved: also delete the copies saved on this device (deliberate leave / new session).
  // release: also release the server reservation. On page departure we keep it so the session can be resumed.
  function clearPhotos(removeSaved=true, release=true) {
    setRestored(false);
    if(removeSaved&&user){
      activeSaved.current=false;
      recoveryWrites.current=recoveryWrites.current.catch(()=>{}).then(()=>Promise.all([deleteDraft(user.id),deleteActiveSession(user.id)])).then(()=>{}).catch(()=>{setRecoveryMessage(t('booth.removeFailed'));});
      setSavedDraft(null);setRecoveryMessage('');
    }
    editingGate.current?.cancel(); setConfirmation({open:false,busy:false,error:''}); setEditingApproved(false);
    if(release)charge.reset(); else charge.forget();
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
        void duoControl.current?.({type:'retake', index:null}).then(commit).catch(() => setSharedError(t('booth.reconnectToReturn')));
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
    // A saved active session keeps its server reservation so it can be resumed after the refresh.
    const clearOnDeparture = () => { editingGate.current?.dispose(); clearPhotos(false, !activeSaved.current); setPendingLeave(null); setStep('mode'); setInstructions(false); };
    // Coming back via the browser's back/forward cache does not reload the page, so check for recovery again.
    const returnFromCache = (event: PageTransitionEvent) => { if (event.persisted) setRecheck(count => count + 1); };
    window.addEventListener('pagehide', clearOnDeparture);
    window.addEventListener('pageshow', returnFromCache);
    return () => { window.removeEventListener('pagehide', clearOnDeparture); window.removeEventListener('pageshow', returnFromCache); };
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
      void duoControl.current?.({ type: 'move', from, to }).then(apply).catch(() => setSharedError(t('booth.reconnectToReorder')));
    } else apply();
  };
  async function retakeFromEdit(index: number | null) {
    if (party.room && source === 'camera') {
      if (party.room.role !== 'host' || !duoControl.current) return;
      try { await duoControl.current({ type: 'retake', index }); setSharedError(''); }
      catch { setSharedError(t('booth.partnerGoneRetake')); return; }
    }
    setRetake(index); setStep(source === 'upload' ? 'upload' : 'session');
  }
  async function createParty() {
    const created = await party.create({ layout: card.layout, template: null, source });
    if (created) {
      try { await charge.reserve(created.code); setStep('room'); }
      catch (error) { party.end(); await offerExistingSession(error); }
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
      // A guest who refreshes keeps the invite link in the address bar. Their seat is still held,
      // so joining again would be refused ("already has two people"): reconnect with the saved seat instead.
      const saved = user ? await readActiveSession(user.id).catch(() => null) as ActiveRecord | null : null;
      if (cancelled) return;
      if (saved?.room?.role === 'guest' && saved.room.invite === invite) {
        activeSaved.current = true;
        try { await resumeRecord(saved); return; }
        catch (error) {
          if (cancelled) return;
          if (!roomGone(error)) { resumeFailed(saved, error); return; }
          // The room is gone: forget the seat and let the normal join show its "expired" message.
          activeSaved.current = false;
          if (user) recoveryWrites.current = recoveryWrites.current.catch(() => {}).then(() => deleteActiveSession(user.id)).catch(() => {});
        }
      }
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
    try { await charge.reserve(); setStep(source === 'upload' ? 'upload' : 'session'); }
    catch (error) { await offerExistingSession(error); /* Otherwise keep the layout and show the error. */ }
  }
  // While the user decides about an unfinished session, only the resume panel is shown.
  const showSteps = active && !conflict;
  const progress: [Step, string][] = [['mode', t('booth.step.mode')], ['source', t('booth.step.source')], ['layout', t('booth.step.layout')], ['session', t('booth.step.session')], ['design', t('booth.step.design')], ['export', t('booth.step.export')]];
  const visibleProgress: [Step, string][] = mode === 'duo' && ['duo', 'join', 'room'].includes(step) ? [['duo', t('booth.step.duo')], ['join', t('booth.step.join')], ['room', t('booth.step.room')]] : progress;
  return <>
    <section id="booth" className="booth flow-booth" data-current-step={step} hidden={!active} aria-label={t('booth.label')}>
      <div className="flow-top"><a href="#" className="back-link">{t('booth.leave')}</a><button className="text-button" id="show-instructions" onClick={() => setInstructions(true)}>{t('nav.how')}</button></div>
      <ol className="flow-steps" aria-label={t('booth.progress')}>{visibleProgress.map(([key, label], index) => <li key={key} data-step={key} className={(step === key || (step === 'upload' && key === 'session')) ? 'current' : ''} aria-current={(step === key || (step === 'upload' && key === 'session')) ? 'step' : undefined}>0{index + 1} <span>{label}</span></li>)}</ol>
      <div id="flow-screen" ref={screen}>
        {active&&savedDraft&&<div className="session-note recovery-panel"><p>{t('booth.draftSaved')}</p><button className="primary" onClick={async()=>{try{if(!savedDraft.guest)await charge.resume(savedDraft.sessionId);recoveredGuest.current=!!savedDraft.guest;setRestored(true);setCard(savedDraft.card);setSource(savedDraft.source);setMode(savedDraft.mode);setEditingApproved(true);setStep('design');setInstructions(false);setSaveRecovery(true);setSavedDraft(null);}catch(e){setSharedError(e instanceof Error?e.message:t('booth.resumeFailed'));}}}>{t('booth.resumeDraft')}</button><button className="text-button" onClick={()=>{if(user)void deleteDraft(user.id).catch(()=>setSharedError(t('booth.deleteFailed')));setSavedDraft(null);}}>{t('booth.deleteDraft')}</button><WarningNotice>{sharedError}</WarningNotice></div>}
        {active&&['session','upload','design','export'].includes(step)&&<details className="session-note recovery-panel recovery-options"><summary>{t(saveRecovery ? 'booth.autosaveOn' : 'booth.autosaveOff')}</summary><label className="recovery-toggle"><input type="checkbox" checked={saveRecovery} onChange={e=>{setSaveRecovery(e.target.checked);if(!e.target.checked&&user){recoveryWrites.current=recoveryWrites.current.catch(()=>{}).then(()=>deleteDraft(user.id)).catch(()=>{setRecoveryMessage(t('booth.removeFailed'));});setRecoveryMessage(t('booth.copyRemoved'));}}}/><span>{t('booth.autosaveLabel')}</span></label><p>{t('booth.autosaveHelp')}</p></details>}{active&&recoveryMessage&&<p className="session-note recovery-status" role="status">{recoveryMessage}</p>}
        {/* Points problems get the top-up link; an "active booth" refusal opens the booth popup instead (fallback text if it cannot be found). */}
        {active && !confirmation.open && !conflict && !checkingConflict && charge.error && <WarningNotice title={t(/active booth/i.test(charge.error) ? 'booth.alreadyOpen' : 'booth.beforeContinue')}>
          {/active booth/i.test(charge.error) ? <p>{t('booth.alreadyOpenText')}</p> : <p>{tm(charge.error)}</p>}
          {needsPoints(charge.error) && <><a href="#account/buy" target="_blank" rel="noopener noreferrer">{t('booth.topUp')}</a><p>{t('booth.photosStay')}</p></>}</WarningNotice>}
        {active && ['session','upload','design','export'].includes(step) && <div className="session-note" aria-live="polite">
          {party.room?.role === 'guest' ? t('booth.guestCovered') : charge.busy ? t('booth.confirmingSession') : charge.receipt ? tm(charge.receipt) : t('booth.nothingYet')}
        </div>}
        {showSteps && step === 'mode' && <ModeScreen onChoose={choice => { setMode(choice); clearPhotos(); change({template:null}); setStep('source'); }} />}
        {showSteps && step === 'duo' && <DuoChoice onCreate={() => { party.end(); setStep('layout'); }} onJoin={() => { party.end(); setUseInvite(false); setStep('join'); }} onBack={() => setStep('source')} />}
        {showSteps && step === 'join' && <JoinRoom invite={useInvite ? invite : null} busy={party.busy} error={party.error} onJoin={joinParty} onBack={() => { party.end(); setStep('duo'); }} />}
        {showSteps && step === 'room' && party.room && <WaitingRoom mirror={mirror} onMirrorChange={setMirror} room={party.room} busy={party.busy} error={party.error} onReady={value => { void party.ready(value); }} onContinue={enterParty} onLeave={() => requestLeave(() => { party.end(); setStep('duo'); })} />}
        {showSteps && step === 'layout' && <><LayoutScreen busy={party.busy || charge.busy} selected={card.layout} onSelect={layout => { if (layout !== card.layout) change({ layout, shots: [], template: null }); setRetake(null); }} onBack={() => setStep(mode === 'duo' && source === 'camera' ? 'duo' : 'source')} onNext={() => void startSession()} /><WarningNotice>{party.error}</WarningNotice></>}
        {showSteps && step === 'source' && <SourceScreen mode={mode} onBack={() => setStep('mode')} onChoose={choice => { change({ shots: [], template: null }); setSource(choice); setRetake(null); setStep(mode === 'duo' && choice === 'camera' ? 'duo' : 'layout'); }} />}
        {showSteps && (step === 'session' || ['design','export'].includes(step) && party.room && source === 'camera') && <div hidden={step !== 'session'}><SessionScreen room={party.room} visible={step === 'session'} duoControl={duoControl} onPartnerConnection={setPeerConnected} onPartnerExit={() => setExplicitDisconnect(true)} onSharedPhotos={shots => change({ shots })} onRemoteSession={index => { setRetake(index); setStep('session'); }} card={card} method={method} seconds={seconds} onMethod={setMethod} onSeconds={setSeconds} retake={retake} onRetake={setRetake} restoreCamera={restoreCamera} interrupted={instructions || !!pendingLeave || confirmation.open || disconnectOpen} flash={flash} flashColor={flashColor} onFlashChange={setFlash} onFlashColor={setFlashColor} mirror={mirror} onMirrorChange={setMirror}
          beforeReview={requestEditing} onShot={(index, shot) => setCard(current => ({ ...current, shots: replaceShot(current.shots, index, shot), offsets: reconcileOffsets(current.shots, current.offsets, replaceShot(current.shots, index, shot)) }))} onMove={reorder} onBack={() => goBack('layout')} onNext={wasCamera => { setRestoreCamera(wasCamera); setRetake(null); setEditingApproved(true); setStep('design'); }} /></div>}
        {showSteps && step === 'upload' && mode === 'solo' && <UploadScreen card={card} replacement={retake} onPhotos={shots => { change({ shots }); setRetake(null); }} onMove={reorder} onBack={() => goBack('layout')} onNext={() => void reviewUploads()} />}
        {showSteps && step === 'upload' && mode === 'duo' && <DuoUploadScreen card={card} photos={duoUploads} onPhotos={setDuoUploads} onBack={() => goBack('layout')} onNext={shots => void reviewUploads(shots)} />}
        {showSteps && editingApproved && (step === 'design' || step === 'export') && <><EditScreen stage={step} onContinue={() => setStep('export')} photosLocked={restored || party.room?.role === 'guest' && source === 'camera'} source={source} card={card} onChange={change} onMove={reorder} onRetake={index => { void retakeFromEdit(index); }} onBack={() => void retakeFromEdit(null)} onDesign={() => setStep('design')} /><WarningNotice>{sharedError}</WarningNotice></>}
      </div>
    </section>
    <ActiveBoothDialog open={active && !!conflict} info={conflict ? boothInfo(conflict) : null} continueAfterClose={conflict?.origin === 'start'} busy={resuming || closing} error={conflict?.error} onResume={() => void resumeConflict()} onClose={() => void startNewSession()} />
    <Instructions open={active && !savedDraft && !conflict && instructions && !disconnectOpen && !pendingLeave && !confirmation.open} onDismiss={() => setInstructions(false)} onContinue={() => setInstructions(false)} />
    <div id="print-sheet" aria-hidden="true" />
    <LeaveDialog duo={duoActive} open={!!pendingLeave} count={duoUploads.some(Boolean) ? duoUploads.filter(Boolean).length : card.shots.filter(Boolean).length} onCancel={() => setPendingLeave(null)} onConfirm={() => { const proceed = pendingLeave; setPendingLeave(null); void duoControl.current?.({type:'leave'}).catch(() => {}); clearPhotos(); proceed?.(); }} />
    <BoothDialog open={active && confirmation.open && !disconnectOpen && !pendingLeave} title={t('booth.confirm.title')} cancelLabel={t('booth.confirm.cancel')} confirmLabel={t(charge.cost === 0 ? 'booth.confirm.trial' : 'booth.confirm.points')} busy={confirmation.busy} error={confirmation.error} onCancel={() => editingGate.current?.cancel()} onConfirm={() => void editingGate.current?.confirm()}>
      <p>{charge.cost === 0 ? t('booth.confirm.textTrial') : t('booth.confirm.textPoints', { n: charge.cost ?? 100 })}</p>
    </BoothDialog>
    <BoothDialog open={disconnectOpen} title={t('booth.lost.title')} cancelLabel={t('booth.lost.stay')} confirmLabel={t('booth.lost.leave')} busy={confirmation.busy} onCancel={() => { setDisconnectAcknowledged(true); void party.check(); }} onConfirm={() => { editingGate.current?.cancel(); clearPhotos(); party.end(); setStep('mode'); }}>
      <p>{t(explicitDisconnect ? 'booth.lost.left' : 'booth.lost.connection')} {t('booth.lost.question')}</p>
    </BoothDialog>
  </>;
}
