export function readEmailCallback(href) {
 const url=new URL(href),token=url.searchParams.get('auth_token_hash'),type=url.searchParams.get('auth_type');
 if(!token||!['email','recovery'].includes(type)||token.length>1024)return null;
 return {token_hash:token,type};
}
export function cleanEmailCallback(href){
 const url=new URL(href);url.searchParams.delete('auth_token_hash');url.searchParams.delete('auth_type');return url.href;
}
