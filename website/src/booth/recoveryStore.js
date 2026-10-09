// Automatic device-local recovery, with a user opt-out. No server photo upload.
import {layouts,filters} from './core.js';
const TTL=24*60*60*1000;
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('together-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function operation(user,mode,value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('drafts');const req=mode==='read'?store.get(user):mode==='delete'?store.delete(user):store.put(value,user);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export function validDraft(draft,now=Date.now()){
 const card=draft?.card,layout=card&&layouts[card.layout];
 return !!draft&&draft.version===1&&Number.isFinite(draft.expires)&&draft.expires>now&&typeof draft.sessionId==='string'&&!!layout&&Object.hasOwn(filters,card.filter)&&Array.isArray(card.shots)&&card.shots.length===layout.count&&Array.from(card.shots).every(p=>typeof p==='string'&&p.startsWith('data:image/')&&p.length<12000000)&&typeof card.caption==='string';
}
export async function readDraft(user){const value=await operation(user,'read');if(!validDraft(value)){await deleteDraft(user);return null;}return value;}
export const deleteDraft=user=>operation(user,'delete');
export async function saveDraft(user,draft){await operation(user,'write',{...draft,version:1,expires:Date.now()+TTL});}

// ---------------------------------------------------------------------------
// Active "Your photos" session (before editing is confirmed): Solo, Duo room, or Duo upload.
//
// The editing draft above is only written once every photo exists and editing
// is paid for. This second record covers the earlier part of the booth: it is
// written as soon as a reservation exists, so a refresh during capture/upload
// can put the user back in the same session instead of the first step.
//
// It lives in the same IndexedDB store under a separate key, so no database
// version upgrade is needed and existing saved drafts are untouched.
// ---------------------------------------------------------------------------
const activeKey=user=>`${user}:active`;

/** A partially captured photo slot may be empty; a filled one must be an image data URL. */
const validSlot=p=>p==null||p===''||(typeof p==='string'&&p.startsWith('data:image/')&&p.length<12000000);

// Saved duo room credentials: the room code and this person's own room token.
// They only work for this signed-in account and expire with the room (45 minutes).
function validRoom(room){
 return !!room&&typeof room==='object'
  &&typeof room.code==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(room.code)
  &&typeof room.token==='string'&&/^[a-f0-9]{48}$/.test(room.token)
  &&(room.role==='host'||room.role==='guest')
  &&(room.invite===undefined||typeof room.invite==='string'&&/^[a-f0-9]{48}$/.test(room.invite));
}
export function validActiveSession(record,now=Date.now()){
 const card=record?.card,layout=card&&layouts[card.layout];
 if(!record||record.version!==1||!Number.isFinite(record.expires)||record.expires<=now)return false;
 if(!layout||!Object.hasOwn(filters,card.filter)||typeof card.caption!=='string')return false;
 if(!Array.isArray(card.shots)||card.shots.length>layout.count||!Array.from(card.shots).every(validSlot))return false; // fewer photos than the layout is fine
 if(record.source!=='camera'&&record.source!=='upload')return false;
 const guest=record.room?.role==='guest';
 // Guests are never billed, so they have no reservation id; everyone else must have one.
 if(typeof record.sessionId!=='string'||(!guest&&record.sessionId.length===0))return false;
 if(record.mode==='solo')return record.room===undefined&&record.step===(record.source==='upload'?'upload':'session');
 if(record.mode!=='duo')return false;
 if(record.source==='camera')return validRoom(record.room)&&(record.step==='room'||record.step==='session');
 // Duo upload: one person uploads photos for both sides, no room involved.
 return record.room===undefined&&record.step==='upload'
  &&Array.isArray(record.duoUploads)&&record.duoUploads.length<=layout.count*2&&Array.from(record.duoUploads).every(validSlot);
}
export async function readActiveSession(user){
 const value=await operation(activeKey(user),'read');
 if(!validActiveSession(value)){if(value!==undefined)await deleteActiveSession(user);return null;}
 return value;
}
export const deleteActiveSession=user=>operation(activeKey(user),'delete');
export async function saveActiveSession(user,record){
 await operation(activeKey(user),'write',{...record,version:1,savedAt:Date.now(),expires:Date.now()+TTL});
}

/** Used on first page load to decide whether to send the user straight back to the booth. */
export async function hasRecoverableWork(user){
 const [draft,active]=await Promise.all([readDraft(user).catch(()=>null),readActiveSession(user).catch(()=>null)]);
 return !!(draft||active);
}
