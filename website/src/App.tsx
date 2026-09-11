import { DecorativeIcon } from './components/DecorativeIcon';
import { useEffect, useRef, useState } from 'react';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Booth } from './booth/Booth';

export function App() {
  const [hash, setHash] = useState(window.location.hash);
  const leaveGuard = useRef<(proceed: () => void) => void>(proceed => proceed());
  const currentHash = useRef(window.location.hash);
  const isBooth = hash === '#booth' || hash.startsWith('#booth?'), isAbout = hash === '#about';
  const invite = isBooth ? new URLSearchParams(hash.split('?')[1] || '').get('invite') : null;
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
    document.title = isBooth ? 'Your booth — Together' : isAbout ? 'About — Together' : 'Together — A little closer.';
    if (isBooth || isAbout || !hash || hash === '#') window.scrollTo(0, 0);
    else document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, isBooth, isAbout]);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><a className="wordmark" href="#" aria-label="Together home">together<span className="brand-dot"><DecorativeIcon /></span></a><nav aria-label="Main navigation"><a href="#how-it-works" className="home-nav" hidden={isBooth}>How it works</a><a href="#about" className="about-nav" aria-current={isAbout ? 'page' : undefined}>About</a></nav></header>
    <main id="main">
      {!isBooth && !isAbout && <Home />}
      {isAbout && <About />}
      <Booth active={isBooth} invite={invite} leaveGuard={leaveGuard} />
    </main>
  </>;
}
