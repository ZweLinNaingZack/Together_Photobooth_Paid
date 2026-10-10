// Small Terms / Privacy / Refunds links for page footers.
// Kept in its own file so pages that show these links don't also download the full policy text.
export function LegalLinks() {
  return <nav className="legal-links" aria-label="Legal">
    <a href="#terms">Terms</a>
    <a href="#privacy">Privacy</a>
    <a href="#refunds">Refunds</a>
  </nav>;
}
