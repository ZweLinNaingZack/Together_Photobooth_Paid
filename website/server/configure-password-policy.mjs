// Run explicitly with a Supabase management token in the shell environment.
// Never use the service-role key or put the management token in VITE variables.
const {SUPABASE_ACCESS_TOKEN:token,SUPABASE_PROJECT_REF:ref}=process.env;
if(!token||!ref||!/^[a-z0-9]+$/.test(ref))throw new Error('Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in your shell.');
const policy={password_min_length:8,password_required_characters:'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*(),.?"\\:{}|<>'};
if(!process.argv.includes('--apply')){console.log('Preview only. Add --apply to update Supabase Auth:',policy);process.exit(0);}
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(policy)});
if(!response.ok)throw new Error(`Could not apply password policy: HTTP ${response.status}`);
const config=await response.json();
if(config.password_min_length!==8||config.password_required_characters!==policy.password_required_characters)throw new Error('Policy readback did not match. Inspect Supabase Auth settings.');
console.log('Server password policy updated and verified.');
