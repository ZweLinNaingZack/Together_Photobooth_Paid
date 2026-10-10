import { Fragment, useState, type ReactNode } from 'react';
import { LEGAL_LANGUAGES, LANG_ORDER, type LangCode, type PageId } from './legalText';

// ---------------------------------------------------------------------------
// Terms of Service, Privacy Policy and Refund Policy, in English, Burmese and Vietnamese.
// The words live in legalText.ts; this file only lays them out.
// Change LAST_UPDATED whenever the wording changes, e.g. on launch day.
// ---------------------------------------------------------------------------
export const LAST_UPDATED = '2026-10-10'; // year-month-day; shown in each language's date style
const OPERATOR = 'Zwe Lin Naing';
const CONTACT = 'togetherphotobooth.xyz@gmail.com';
const STORAGE_KEY = 'together.legalLang';
const PAGES: PageId[] = ['terms', 'privacy', 'refunds'];

// Remember the chosen language while moving between the three pages.
// Saved in the browser too, but wrapped in try/catch because storage can be blocked
// (private windows, strict settings). The variable is the fallback.
let rememberedLang: LangCode | null = null;
function initialLang(): LangCode {
  if (rememberedLang) return rememberedLang;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in LEGAL_LANGUAGES) return saved as LangCode;
  } catch { /* storage blocked: start in English */ }
  return 'en';
}
function saveLang(lang: LangCode) {
  rememberedLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
}

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

/** One policy page in the chosen language, with the language buttons at the top. */
function LegalPage({ id }: { id: PageId }) {
  const [lang, setLang] = useState<LangCode>(initialLang);
  const text = LEGAL_LANGUAGES[lang];
  const page = text.pages[id];
  const choose = (next: LangCode) => { setLang(next); saveLang(next); };

  // lang="" tells browsers and screen readers which language the text is in
  // (it also helps the browser pick a font that has Burmese letters).
  return <section id={id} className="legal-page" lang={text.locale} aria-labelledby={`${id}-title`}>
    <div className="legal-top">
      <a className="back-link" href="#">{text.back}</a>
      <div className="legal-lang" role="group" aria-label={text.pickLabel}>
        {LANG_ORDER.map(code => (
          // Each button is written in its own language so people can find theirs.
          <button key={code} type="button" lang={LEGAL_LANGUAGES[code].locale}
            aria-pressed={code === lang} onClick={() => choose(code)}>
            {LEGAL_LANGUAGES[code].label}
          </button>
        ))}
      </div>
    </div>
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
