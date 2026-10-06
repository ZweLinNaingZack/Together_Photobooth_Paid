// Allowlisted measurements only. Never accept arbitrary errors, URLs or user data.
const entries=[];
const allowed=new Set(['camera_connected','camera_retry','camera_failed','export_ready','export_failed','preview_failed']);
export function recordDiagnostic(event,duration=0){
 if(!allowed.has(event))return '';
 const reference=crypto.randomUUID().slice(0,8);
 entries.push({reference,event,durationMs:Math.max(0,Math.round(duration)),at:new Date().toISOString()});
 if(entries.length>40)entries.shift();
 return reference;
}
export function diagnosticReport(){return JSON.stringify({version:1,events:entries},null,2);}
