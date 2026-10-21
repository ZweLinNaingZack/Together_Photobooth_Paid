import { useEffect } from 'react';

/**
 * Gentle "fade up" for page sections as they scroll into view.
 *
 * How to use: give an element the class `reveal` (and optionally a CSS variable
 * `--reveal-delay` for a small stagger). This hook watches the page and adds
 * `is-visible` the first time each one appears on screen; polish.css does the animation.
 *
 * Safe by design:
 * - The hidden starting state only applies after this hook adds `reveal-ready` to <html>,
 *   so if JavaScript fails, nothing stays invisible.
 * - People who turn on "reduce motion" on their phone/computer get no animation (see CSS).
 * - New content (another page, a language change) is picked up by a MutationObserver.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const root = document.documentElement;
    root.classList.add('reveal-ready');
    const seen = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        seen.unobserve(entry.target);   // animate once, then stop watching
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    const watch = () => document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => seen.observe(el));
    watch();
    // Check for new sections at most once per frame (the booth changes the page often).
    let frame = 0;
    const changes = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; watch(); }); });
    changes.observe(document.body, { childList: true, subtree: true });
    return () => { seen.disconnect(); changes.disconnect(); cancelAnimationFrame(frame); root.classList.remove('reveal-ready'); };
  }, []);
}
