import { DecorativeIcon } from './components/DecorativeIcon';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
const Account = lazy(() => import('./auth/Account').then(m=>({default:m.Account})));
import { useAuth } from './auth/AuthProvider';
import { SignInDialog } from './components/SignInDialog';
import { Home } from './pages/Home';
const About = lazy(() => import('./pages/About').then(m=>({default:m.About})));
// The three policy pages load only when someone opens them, so they don't slow the home page.
const Terms = lazy(() => import('./pages/Legal').then(m=>({default:m.Terms})));
const Privacy = lazy(() => import('./pages/Legal').then(m=>({default:m.Privacy})));
const Refunds = lazy(() => import('./pages/Legal').then(m=>({default:m.Refunds})));
const Contact = lazy(() => import('./pages/Legal').then(m=>({default:m.Contact})));
import { LegalLinks } from './pages/LegalLinks';
const Booth = lazy(() => import('./booth/Booth').then(m=>({default:m.Booth})));
import { rememberBoothReturn, consumeBoothReturn } from './auth/inviteReturn.js';
import { hasRecoverableWork } from './booth/recoveryStore.js';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useT, type Key } from './i18n';

// Policy pages and Contact: hash → browser tab title key.
const LEGAL_PAGES: Record<string, Key | undefined> = { '#terms': 'title.terms', '#privacy': 'title.privacy', '#refunds': 'title.refunds', '#contact': 'title.contact' };

export function App() {
  const { user, loading, recovery, emailLink, error: authError } = useAuth();
  const t = useT();   // redraws the whole app when the language changes
  const [hash, setHash] = useState(window.location.hash);
  const leaveGuard = useRef<(proceed: () => void) => void>(proceed => proceed());
  const currentHash = useRef(window.location.hash);
  const [boothOpened,setBoothOpened]=useState(false);
  const isBooth = hash === '#booth' || hash.startsWith('#booth?'), isAbout = hash === '#about', legal = LEGAL_PAGES[hash], isAccount = ['#account', '#account/buy', '#account/admin'].includes(hash);
  const invite = isBooth ? new URLSearchParams(hash.split('?')[1] || '').get('invite') : null;
  useEffect(()=>{if(isBooth&&user)setBoothOpened(true);},[isBooth,user]);
  // Returning to the home page with an unfinished booth on this device (refresh, closed tab,
  // reopened browser) goes straight back to the booth, which then restores the session.
  // Runs once per page load and never overrides a page the user asked for (about, account…).
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (loading || !user || recovery || emailLink || recoveryChecked.current) return;
    recoveryChecked.current = true;
    const onHome = () => !window.location.hash || window.location.hash === '#';
    if (!onHome()) return;
    void hasRecoverableWork(user.id).then(found => { if (found && onHome()) window.location.hash = 'booth'; }).catch(() => {});
  }, [loading, user, recovery, emailLink]);
  useEffect(() => { if(!loading && !user && isBooth) rememberBoothReturn(hash); }, [loading,user,isBooth,hash]);
  useEffect(() => { if(!loading && user && !recovery && !emailLink && !authError && isAccount && hash !== '#account/admin') { const target=consumeBoothReturn(); if(target) window.location.hash=target; } }, [loading,user,recovery,emailLink,authError,isAccount,hash]);
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
  // Browser tab title, in the current language (updates when the language changes too).
  const title = t(isAccount ? 'title.account' : isBooth ? 'title.booth' : isAbout ? 'title.about' : legal ?? 'title.home');
  useEffect(() => { document.title = title; }, [title]);
  useEffect(() => {
    if (isAccount || isBooth || isAbout || legal || !hash || hash === '#') window.scrollTo(0, 0);
    else document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, isBooth, isAbout, isAccount, legal]);
  return <>
    <a className="skip-link" href="#main">{t('nav.skip')}</a>
    <header className="header"><a className="wordmark" href="#" aria-label={t('nav.home')}>together<span className="brand-dot"><DecorativeIcon /></span></a><nav aria-label={t('nav.main')}><a href="#how-it-works" className="home-nav" hidden={isBooth}>{t('nav.how')}</a><a href="#about" className="about-nav" aria-current={isAbout ? 'page' : undefined}>{t('nav.about')}</a><a href="#contact" className="contact-nav" aria-current={hash === '#contact' ? 'page' : undefined}>{t('nav.contact')}</a><a href="#account" className="account-nav" aria-current={isAccount ? 'page' : undefined}>{user ? t('nav.myAccount') : t('nav.signIn')}</a><LanguageSwitcher /></nav></header>
    <main id="main"><Suspense fallback={<p className="session-note" role="status">{t('nav.loading')}</p>}>
      {(!isBooth && !isAbout && !isAccount && !legal || isBooth && !user) && <Home />}
      {isAccount && <Account page={hash === '#account/buy' ? 'buy' : hash === '#account/admin' ? 'admin' : 'overview'} />}
      {isAbout && <About />}
      {hash === '#terms' && <Terms />}
      {hash === '#privacy' && <Privacy />}
      {hash === '#refunds' && <Refunds />}
      {hash === '#contact' && <Contact />}
      {/* Policy links at the bottom of every page except the booth (Home has its own footer). */}
      {(isAbout || isAccount || legal) && <footer className="site-footer"><LegalLinks /></footer>}
      {loading && isBooth && <p role="status">{t('nav.checkingAccount')}</p>}
      {!loading && user && (isBooth||boothOpened) && <Booth key={user.id} active={isBooth} invite={invite} leaveGuard={leaveGuard} />}
      {!loading && !user && isBooth && <SignInDialog onDismiss={() => { consumeBoothReturn(); window.location.hash = ''; }} onSignIn={() => {
        rememberBoothReturn(hash);
      }} />}
    </Suspense></main>
  </>;
}
