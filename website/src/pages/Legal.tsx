import { Fragment, type ReactNode } from 'react';
import { useLang } from '../i18n';
import { LEGAL_LANGUAGES, type ContactId, type LangCode, type PageId } from './legalText';

// ---------------------------------------------------------------------------
// Terms of Service, Privacy Policy and Refund Policy, in English, Burmese and Vietnamese.
// The words live in legalText.ts; this file only lays them out.
// Change LAST_UPDATED whenever the wording changes, e.g. on launch day.
// ---------------------------------------------------------------------------
export const LAST_UPDATED = '2026-10-10'; // year-month-day; shown in each language's date style
const OPERATOR = 'Zwe Lin Naing';
const CONTACT = 'togetherphotobooth.xyz@gmail.com';

// Contact page details. To add Facebook or Telegram later, fill in `shown` (what people see)
// and `href` (the link). Cards with an empty href show "Coming soon" instead of a button.
const CONTACTS: { id: ContactId; shown: string; href: string; kind: 'call' | 'write' | 'open' }[] = [
  { id: 'phone', shown: '+84 911 017 625', href: 'tel:+84911017625', kind: 'call' },
  { id: 'email', shown: CONTACT, href: `mailto:${CONTACT}`, kind: 'write' },
  { id: 'tiktok', shown: '@togetherphotobooth', href: 'https://www.tiktok.com/@togetherphotobooth', kind: 'open' },
  { id: 'facebook', shown: '', href: '', kind: 'open' }, // e.g. shown: 'Together Photobooth', href: 'https://facebook.com/...'
  { id: 'telegram', shown: '', href: '', kind: 'open' }, // e.g. shown: '@togetherphotobooth', href: 'https://t.me/...'
];
/** "2026-10-10" → "10 October 2026" / "၂၀၂၆ အောက်တိုဘာ ၁၀" / "10 tháng 10, 2026". */
function formatDate(locale: string) {
  const date = new Date(`${LAST_UPDATED}T12:00:00Z`);
  // Some browsers have no Burmese date data and fall back to English, so build it by hand.
  if (locale === 'my') {
    const months = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'ဩဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
    const digits = (n: number) => String(n).replace(/\d/g, d => '၀၁၂၃၄၅၆၇၈၉'[Number(d)]); // 2026 → ၂၀၂၆
    return `${digits(date.getUTCDate())} ${months[date.getUTCMonth()]} ${digits(date.getUTCFullYear())}`;
  }
  try { return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date); }
  catch { return LAST_UPDATED; } // very old browsers
}

/**
 * Turns the small markup in legalText.ts into React elements:
 * **bold**, [text](#hash), {mail}, {operator}. Anything else stays plain text.
 */
function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(#[a-z]+\)|\{mail\}|\{operator\})/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((#[a-z]+)\)$/);
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
    if (part === '{mail}') return <a key={i} href={`mailto:${CONTACT}`}>{CONTACT}</a>;
    if (part === '{operator}') return <Fragment key={i}>{OPERATOR}</Fragment>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const PAGES: PageId[] = ['terms', 'privacy', 'refunds'];

/** The site language (chosen with the button in the top bar), as policy text. */
function usePolicyLang() {
  const lang = useLang() as LangCode;   // same codes: 'en' | 'my' | 'vi'
  return { lang, text: LEGAL_LANGUAGES[lang] };
}

/** "Back home" link above each page. The language is changed with the button in the top bar. */
function TopBar({ lang }: { lang: LangCode }) {
  return <div className="legal-top"><a className="back-link" href="#">{LEGAL_LANGUAGES[lang].back}</a></div>;
}

/** One policy page in the chosen language, with the language buttons at the top. */
function LegalPage({ id }: { id: PageId }) {
  const { lang, text } = usePolicyLang();
  const page = text.pages[id];

  // lang="" tells browsers and screen readers which language the text is in
  // (it also helps the browser pick a font that has Burmese letters).
  return <section id={id} className="legal-page" lang={text.locale} aria-labelledby={`${id}-title`}>
    <TopBar lang={lang} />
    <header className="legal-header">
      <h1 id={`${id}-title`}>{page.title}</h1>
      <p className="legal-updated">{text.updated} {formatDate(text.locale)}</p>
      {text.notice && <p className="legal-notice">{text.notice}</p>}
      <div className="legal-intro"><p>{rich(page.intro)}</p></div>
    </header>
    <div className="legal-body">
      {page.sections.map(section => <Fragment key={section.h}>
        <h2>{section.h}</h2>
        {/* A string is a paragraph; an array is a bullet list. */}
        {section.body.map((block, i) => typeof block === 'string'
          ? <p key={i}>{rich(block)}</p>
          : <ul key={i}>{block.map((item, j) => <li key={j}>{rich(item)}</li>)}</ul>)}
      </Fragment>)}
    </div>
    <nav className="legal-switch" aria-label="Policies">
      {PAGES.map(other => (
        <a key={other} href={`#${other}`} aria-current={other === id ? 'page' : undefined}>{text.pages[other].title}</a>
      ))}
    </nav>
  </section>;
}

export const Terms = () => <LegalPage id="terms" />;
export const Privacy = () => <LegalPage id="privacy" />;
export const Refunds = () => <LegalPage id="refunds" />;

/** Contact page: one card per way to reach us, in the chosen language. */
export function Contact() {
  const { lang, text } = usePolicyLang();
  const words = text.contact;
  return <section id="contact" className="legal-page contact-page" lang={text.locale} aria-labelledby="contact-title">
    <TopBar lang={lang} />
    <header className="legal-header">
      <h1 id="contact-title">{words.title}</h1>
      <div className="legal-intro"><p>{words.intro}</p></div>
    </header>
    <ul className="contact-list">
      {CONTACTS.map(item => {
        const ready = item.href !== '';
        // Social links open in a new tab; phone and email open the phone or mail app.
        const external = item.href.startsWith('https://');
        return <li key={item.id} className={ready ? 'contact-card' : 'contact-card is-soon'}>
          <span className="contact-label">{words.labels[item.id]}</span>
          {/* dir="ltr" keeps the phone number and email in the right order inside any language. */}
          <span className="contact-value" dir="ltr">{!ready ? words.soon : item.id === 'email'
            ? <>{item.shown.split('@')[0]}@<wbr />{item.shown.split('@')[1]}</> // long email may wrap only after "@"
            : item.shown}</span>
          {ready && <a className="contact-action" href={item.href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {words[item.kind]}<span aria-hidden="true"> →</span>
          </a>}
        </li>;
      })}
    </ul>
    <p className="contact-tip">{words.tip}</p>
  </section>;
}
