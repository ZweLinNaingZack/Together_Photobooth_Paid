import { strongPassword } from '../src/auth/passwordPolicy.js';
export function makeAccountHandler({env=process.env,fetcher=fetch}={}) {return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({code:'method_not_allowed'});
 const {operation,password,email,captchaToken}=req.body||{};
 if(!['signup','update'].includes(operation))return res.status(400).json({code:'invalid_request'});
 if(!strongPassword(password))return res.status(422).json({code:'weak_password'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!env.SITE_URL)return res.status(503).json({code:'service_unavailable'});
 const signup=operation==='signup',authorization=String(req.headers.authorization||'');
 if(signup&&(typeof email!=='string'||email.length>254||!/^[^\s@]+@gmail\.com$/i.test(email.trim())||typeof captchaToken!=='string'||!captchaToken))return res.status(400).json({code:'invalid_request'});
 if(!signup&&!/^Bearer \S+$/.test(authorization))return res.status(401).json({code:'session_expired'});
 try{
  const endpoint=new URL(`/auth/v1/${signup?'signup':'user'}`,url);
  if(signup)endpoint.searchParams.set('redirect_to',new URL('/#account',env.SITE_URL).href);
  const response=await fetcher(endpoint,{method:signup?'POST':'PUT',headers:{apikey:key,'Content-Type':'application/json',...(!signup?{Authorization:authorization}:{})},body:JSON.stringify(signup?{email:email.trim(),password,gotrue_meta_security:{captcha_token:captchaToken}}:{password}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok)return res.status(response.status).json({code:data.error_code||data.code||'account_request_failed'});
  // Do not return provider user details, or reveal whether a signup email exists.
  return res.status(200).json({ok:true});
 }catch{return res.status(503).json({code:'service_unavailable'});}
};}
export default makeAccountHandler();
