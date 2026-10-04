const KEY = 'together-after-signin';
const TTL = 60 * 60 * 1000;
export function safeBoothReturn(value) {
  if(value === '#booth') return value;
  if(typeof value !== 'string' || !value.startsWith('#booth?')) return null;
  const params = new URLSearchParams(value.slice(7)), invite = params.get('invite');
  if(!invite || invite.length > 1024 || /[\s\x00-\x1f]/.test(invite)) return null;
  return `#booth?invite=${encodeURIComponent(invite)}`;
}
export function rememberBoothReturn(value, storage = sessionStorage, now = Date.now()) {
  const target = safeBoothReturn(value);if(!target)return;
  try {storage.setItem(KEY,JSON.stringify({target,expires:now+TTL}));} catch { /* Storage may be unavailable. */ }
}
export function readBoothReturn(storage = sessionStorage, now = Date.now()) {
  try {const raw=storage.getItem(KEY);if(!raw)return null;const saved=JSON.parse(raw);return saved.expires>now ? safeBoothReturn(saved.target) : null;}catch{return null;}
}
export function consumeBoothReturn(storage = sessionStorage, now = Date.now()) {
  const target=readBoothReturn(storage,now);try{storage.removeItem(KEY);}catch{}return target;
}
