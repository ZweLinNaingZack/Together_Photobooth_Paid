import { useState } from 'react';
import { Captcha } from './Captcha';
import { supabase, authRedirect } from './client';
import { authErrorMessage } from './errors';
import { WarningNotice } from '../components/WarningNotice';
export function SecuritySettings({email}:{email:string}) {
 const [open,setOpen]=useState(false),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[message,setMessage]=useState(''),[error,setError]=useState('');
 return <section className="account-security"><h2>Account security</h2><p>Send a secure link to your email to reset or change your password.</p><button className="outline-button" onClick={()=>setOpen(!open)} aria-expanded={open}>Reset / Change Password</button>{open&&<div><Captcha key={attempt} onToken={setToken}/><button className="primary" disabled={busy||!token} onClick={async()=>{if(!supabase||busy)return;setBusy(true);setError('');try{const result=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirect(true),captchaToken:token});if(result.error)throw result.error;setMessage('Check your inbox for the password reset link. Open it in this browser.');}catch(e){setError(authErrorMessage(e as Parameters<typeof authErrorMessage>[0]));}finally{setBusy(false);setToken('');setAttempt(n=>n+1);}}}>{busy?'Sending…':'Email me a reset link'}</button></div>}{message&&<p role="status">{message}</p>}{error&&<WarningNotice>{error}</WarningNotice>}</section>;
}
