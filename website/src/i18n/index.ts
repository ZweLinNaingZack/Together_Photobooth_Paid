// ---------------------------------------------------------------------------
// Site language: English, Burmese (မြန်မာ) and Vietnamese (Tiếng Việt).
//
// How it works:
// - All words live in en.ts / my.ts / vi.ts under the same keys, e.g. 'home.cta'.
// - t('home.cta') returns the words in the current language.
// - Components call useT() (or useLang()) so they redraw when the language changes.
// - English always loads. Burmese and Vietnamese download only when someone picks them,
//   so English visitors don't pay for the extra text.
// - First visit: we follow the phone/browser language. A choice made with the
//   language button is remembered on this device.
// ---------------------------------------------------------------------------
import { useSyncExternalStore } from 'react';
import { en, type Key } from './en';

export type { Key };
export type Lang = 'en' | 'my' | 'vi';

/** Shown in the language menu. `short` is what the nav button shows. */
export const LANGUAGES: { code: Lang; label: string; english: string; short: string; locale: string }[] = [
  { code: 'en', label: 'English', english: 'English', short: 'EN', locale: 'en' },
  { code: 'my', label: 'မြန်မာ', english: 'Burmese', short: 'မြန်မာ', locale: 'my' },
  { code: 'vi', label: 'Tiếng Việt', english: 'Vietnamese', short: 'VI', locale: 'vi' },
];

const STORAGE_KEY = 'together.lang';
const OLD_POLICY_KEY = 'together.legalLang'; // used by the policy pages before the whole site was translated
const dictionaries: Partial<Record<Lang, Record<Key, string>>> = { en };
let current: Lang = 'en';
const listeners = new Set<() => void>();

const isLang = (value: unknown): value is Lang => value === 'en' || value === 'my' || value === 'vi';

/** Saved choice first, then the phone/browser language, then English. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_POLICY_KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage blocked (private window): just detect */ }
  const wanted = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of wanted) {
    const code = String(tag || '').toLowerCase();
    if (code.startsWith('my')) return 'my';   // Burmese: "my", "my-MM"
    if (code.startsWith('vi')) return 'vi';   // Vietnamese: "vi", "vi-VN"
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

/** Download a language's words the first time it is needed. */
async function load(lang: Lang) {
  if (dictionaries[lang]) return;
  dictionaries[lang] = lang === 'my' ? (await import('./my')).my : (await import('./vi')).vi;
}

/** Switch language. `remember` saves the choice on this device (the nav button does this). */
export async function setLang(lang: Lang, remember = true) {
  await load(lang);
  current = lang;
  document.documentElement.lang = lang;   // also picks the Burmese / Vietnamese CSS in style.css
  if (remember) { try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ } }
  listeners.forEach(listener => listener());
}

/** Called once in main.tsx before the first draw, so a Burmese phone never flashes English. */
export function startLanguage() {
  return setLang(detectLang(), false).catch(() => setLang('en', false));
}

export const getLang = () => current;
export const localeOf = (lang: Lang = current) => LANGUAGES.find(item => item.code === lang)!.locale;

/**
 * Words for `key` in the current language. `{name}` placeholders are filled from `vars`:
 * t('wallet.points', { n: 300 }) → "300 points".
 */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const text = dictionaries[current]?.[key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => name in vars ? String(vars[name]) : match) : text;
}

/** Use inside components: returns t() and redraws the component when the language changes. */
export function useT() { useLang(); return t; }
export function useLang() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getLang, getLang);
}

// Some messages are written in English outside the React code: the server, the database,
// and small helper files. If one exactly matches an English text in en.ts, show it in the
// current language instead. Unknown messages stay as they are.
let reverse: Map<string, Key> | null = null;
export function tm(message: string): string {
  if (!message || current === 'en') return message;
  reverse ??= new Map(Object.entries(en).map(([key, text]) => [text, key as Key]));
  const key = reverse.get(message.trim());
  if (key) return t(key);
  // A few messages contain a number; match those by pattern.
  const attempts = message.match(/^Incorrect email or password\. (\d+) attempts? remaining\.$/);
  if (attempts) return t('msg.wrongPasswordLeft', { n: attempts[1] });
  const upTo = message.match(/^Choose up to (\d+) photos? for the remaining spaces\.$/);
  if (upTo) return t('msg.chooseUpTo', { n: upTo[1] });
  const retrying = message.match(/^Still reconnecting your cameras \(attempt (\d+)\)\. Keep both pages open\.$/);
  if (retrying) return t('msg.stillReconnecting', { n: retrying[1] });
  // Camera errors end with "Support reference: …"; translate the first part and keep the code.
  const withReference = message.match(/^(.*) Support reference: (\S+)\.$/);
  if (withReference) return t('msg.supportRef', { message: tm(withReference[1]), reference: withReference[2] });
  return message;
}

/** Date and time in the current language's style. */
export const formatDate = (value: string | number | Date) => new Date(value).toLocaleDateString(localeOf());
export const formatDateTime = (value: string | number | Date) => new Date(value).toLocaleString(localeOf());
export const formatTime = (value: string | number | Date) => new Date(value).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' });
/** Numbers keep Western digits and commas in every language (prices must match KBZPay). */
export const num = (value: number) => value.toLocaleString('en-US');
