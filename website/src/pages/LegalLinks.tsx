import { useT } from '../i18n';

// Small Contact / Terms / Privacy / Refunds links for page footers.
// Kept in its own file so pages that show these links don't also download the full policy text.
export function LegalLinks() {
  const t = useT();
  return <nav className="legal-links" aria-label={t('footer.legal')}>
    <a href="#contact">{t('footer.contact')}</a>
    <a href="#terms">{t('footer.terms')}</a>
    <a href="#privacy">{t('footer.privacy')}</a>
    <a href="#refunds">{t('footer.refunds')}</a>
  </nav>;
}
