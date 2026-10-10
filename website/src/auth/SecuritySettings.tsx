import { useState } from 'react';
import { Captcha } from './Captcha';
import { supabase, authRedirect } from './client';
import { authErrorMessage } from './errors';
import { WarningNotice } from '../components/WarningNotice';
import { useT } from '../i18n';
export function SecuritySettings({email}:{email:string}) {
 const t=useT();
 const [open,setOpen]=useState(false),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
 return <section className="account-security"><h2>{t('security.title')}</h2><p>{t('security.text')}</p><button className="outline-button" onClick={()=>setOpen(!open)} aria-expanded={open}>{t('security.button')}</button>{open&&<div><Captcha key={attempt} onToken={setToken}/><button className="primary" disabled={busy||!token} onClick={async()=>{if(!supabase||busy)return;setBusy(true);setError('');try{const result=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirect(true),captchaToken:token});if(result.error)throw result.error;setMessage(t('security.sent'));}catch(e){setError(authErrorMessage(e as Parameters<typeof authErrorMessage>[0]));}finally{setBusy(false);setToken('');setAttempt(n=>n+1);}}}>{busy?t('security.sending'):t('security.send')}</button></div>}{message&&<p role="status">{message}</p>}{error&&<WarningNotice>{error}</WarningNotice>}</section>;
}
