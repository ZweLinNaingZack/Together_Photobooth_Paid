import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';
const Context = createContext<{ user: User | null; loading: boolean; recovery: boolean; finishRecovery: () => void; error: string }>({ user: null, loading: true, recovery: false, finishRecovery() {}, error: '' });
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(new URLSearchParams(location.search).get('recovery') === '1'), [error, setError] = useState('');
  function finishRecovery() { setRecovery(false); const u = new URL(location.href); u.searchParams.delete('recovery'); history.replaceState(null, '', u); }
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    const params = new URLSearchParams(location.search), fragment = new URLSearchParams(location.hash.slice(1));
    const callback = params.has('code'), failed = params.has('error') || fragment.has('error');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      if (event === 'SIGNED_IN') setError('');
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); location.hash = 'account'; }
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(data.session?.user || null);
      if (error || failed || callback && !data.session) setError('This link could not be completed. Request a new link and open it in the browser where you requested it.');
      if (callback || failed) { const u = new URL(location.href); ['code','error','error_code','error_description'].forEach(k => u.searchParams.delete(k)); history.replaceState(null, '', u); location.hash = 'account'; }
    }).catch(() => { if (active) setError('We could not check your account. Please refresh and try again.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <Context.Provider value={{ user, loading, recovery, finishRecovery, error }}>{children}</Context.Provider>;
}
