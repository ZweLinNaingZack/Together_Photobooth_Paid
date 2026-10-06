import { DecorativeIcon } from './components/DecorativeIcon';
import { useEffect, useRef, useState } from 'react';
import { Account } from './auth/Account';
import { useAuth } from './auth/AuthProvider';
import { SignInDialog } from './components/SignInDialog';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Booth } from './booth/Booth';
import { rememberBoothReturn, consumeBoothReturn } from './auth/inviteReturn.js';

export function App() {
  const { user, loading, recovery, error: authError } = useAuth();
  const [hash, setHash] = useState(window.location.hash);
  const leaveGuard = useRef<(proceed: () => void) => void>(proceed => proceed());
  const currentHash = useRef(window.location.hash);
  const isBooth = hash === '#booth' || hash.startsWith('#booth?'), isAbout = hash === '#about', isAccount = ['#account', '#account/buy', '#account/admin'].includes(hash);
  const invite = isBooth ? new URLSearchParams(hash.split('?')[1] || '').get('invite') : null;
  useEffect(() => { if(!loading && !user && isBooth) rememberBoothReturn(hash); }, [loading,user,isBooth,hash]);
  useEffect(() => { if(!loading && user && !recovery && !authError && isAccount && hash !== '#account/admin') { const target=consumeBoothReturn(); if(target) window.location.hash=target; } }, [loading,user,recovery,authError,isAccount,hash]);
  useEffect(() => {
    const navigate = () => {
      const next = window.location.hash;
      if ((currentHash.current === '#booth' || currentHash.current.startsWith('#booth?')) && next !== currentHash.current) {
        window.history.replaceState(null, '', currentHash.current);
        leaveGuard.current(() => {
          window.history.pushState(null, '', next || window.location.pathname + window.location.search);
          currentHash.current = next;
          setHash(next);
        });
        return;
      }
      currentHash.current = next;
      setHash(next);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    document.title = isAccount ? 'Your account — Together' : isBooth ? 'Your booth — Together' : isAbout ? 'About — Together' : 'Together — A little closer.';
    if (isAccount || isBooth || isAbout || !hash || hash === '#') window.scrollTo(0, 0);
    else document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, isBooth, isAbout, isAccount]);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><a className="wordmark" href="#" aria-label="Together home">together<span className="brand-dot"><DecorativeIcon /></span></a><nav aria-label="Main navigation"><a href="#how-it-works" className="home-nav" hidden={isBooth}>How it works</a><a href="#about" className="about-nav" aria-current={isAbout ? 'page' : undefined}>About</a><a href="#account" className="account-nav" aria-current={isAccount ? 'page' : undefined}>{user ? 'My account' : 'Sign in'}</a></nav></header>
    <main id="main">
      {(!isBooth && !isAbout && !isAccount || isBooth && !user) && <Home />}
      {isAccount && <Account page={hash === '#account/buy' ? 'buy' : hash === '#account/admin' ? 'admin' : 'overview'} />}
      {isAbout && <About />}
      {loading && isBooth && <p role="status">Checking your account…</p>}
      {!loading && user && <Booth key={user.id} active={isBooth} invite={invite} leaveGuard={leaveGuard} />}
      {!loading && !user && isBooth && <SignInDialog onDismiss={() => { consumeBoothReturn(); window.location.hash = ''; }} onSignIn={() => {
        rememberBoothReturn(hash);
      }} />}
    </main>
  </>;
}
