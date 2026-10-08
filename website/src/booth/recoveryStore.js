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
