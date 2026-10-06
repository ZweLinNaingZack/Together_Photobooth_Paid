const key='together-login-lock-until';
export function readLoginLock(storage,now=Date.now()) {
 try {const until=Number(storage.getItem(key));return Number.isFinite(until)&&until>now?Math.min(until,now+300000):0;}catch{return 0;}
}
export function saveLoginLock(storage,until){
 try {if(until>0)storage.setItem(key,String(until));else storage.removeItem(key);}catch{/* Database enforcement does not depend on browser storage. */}
}
