import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Terms of Service, Privacy Policy and Refund Policy.
// Written from how the app actually works (photos never leave people's devices,
// manual KBZPay top-ups, points that never expire, one free trial per email).
// Change LAST_UPDATED whenever the wording changes, e.g. on launch day.
// ---------------------------------------------------------------------------
export const LAST_UPDATED = '10 October 2026';
const OPERATOR = 'Zwe Lin Naing';
const CONTACT = 'zwelinnaing34@gmail.com';

const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

/** Shared layout: title, last-updated date, quick links between the three pages. */
function LegalPage({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return <section id={id} className="legal-page" aria-labelledby={`${id}-title`}>
    <a className="back-link" href="#">Back home</a>
    <header className="legal-header">
      <h1 id={`${id}-title`}>{title}</h1>
      <p className="legal-updated">Last updated {LAST_UPDATED}</p>
      <div className="legal-intro">{intro}</div>
    </header>
    <div className="legal-body">{children}</div>
    <nav className="legal-switch" aria-label="Policies">
      <a href="#terms" aria-current={id === 'terms' ? 'page' : undefined}>Terms of Service</a>
      <a href="#privacy" aria-current={id === 'privacy' ? 'page' : undefined}>Privacy Policy</a>
      <a href="#refunds" aria-current={id === 'refunds' ? 'page' : undefined}>Refund Policy</a>
    </nav>
  </section>;
}

export function Terms() {
  return <LegalPage id="terms" title="Terms of Service" intro={<p>These terms explain how you can use Together, an online photobooth for making photo cards alone or with someone far away. By creating an account or using the booth, you agree to them. Together is run by {OPERATOR}, an individual based in Myanmar (“we”, “us”).</p>}>
    <h2>1. Who can use Together</h2>
    <p>Anyone can use Together, with these conditions for younger people:</p>
    <ul>
      <li><strong>Under 13:</strong> only with a parent’s or guardian’s permission and supervision. The parent or guardian accepts these terms on the child’s behalf.</li>
      <li><strong>Under 18:</strong> buying points needs a parent’s or guardian’s permission.</li>
    </ul>
    <p>If we learn that an account breaks these conditions, we may close it.</p>

    <h2>2. Your account</h2>
    <ul>
      <li>Accounts use a Gmail address. You can sign in with Google, or with an email and password after confirming your email address.</li>
      <li>One account per person. Keep your password private; you are responsible for activity on your account.</li>
      <li>You can ask us to delete your account at any time (see the <a href="#privacy">Privacy Policy</a>).</li>
    </ul>

    <h2>3. Points and payments</h2>
    <ul>
      <li>Booth sessions are paid with points. One session costs <strong>100 points</strong>. Each email address gets <strong>one free session</strong>, used before any points.</li>
      <li>Points are charged only when you confirm that you are ready to edit. Retakes and downloads in that session are included. In a duo booth, only the person who created the booth pays; the person who joins is never charged.</li>
      <li>You buy points by bank transfer (KBZPay, in MMK) and upload your receipt. We check each transfer by hand and add the points once it is confirmed, so it is not instant.</li>
      <li>Points never expire. They have no cash value, cannot be exchanged for money, and cannot be transferred to another account.</li>
      <li>Prices are shown on the Buy points page at the time you buy. Refunds are covered by our <a href="#refunds">Refund Policy</a>.</li>
    </ul>

    <h2>4. Using the booth</h2>
    <ul>
      <li>The booth uses your camera only after you allow it in your browser. Only invite people who want to join you.</li>
      <li>Do not use Together to harass, threaten or exploit anyone, to share sexual content involving minors, or for anything illegal. We may close accounts that do.</li>
      <li>Do not try to break, overload or get around the service’s security, limits or payments.</li>
    </ul>

    <h2>5. Your photos</h2>
    <p>Your photos are yours. They are taken and edited on your device; in a duo booth they travel directly between your two devices. We do not receive, store or use them. Please download your card before you leave; the booth only keeps a temporary copy in your own browser for up to 24 hours to help you recover from a refresh.</p>

    <h2>6. Availability and changes</h2>
    <p>Together is provided “as is”. We work to keep it running well, but it may sometimes be slow, interrupted or changed, and live video depends on both people’s devices and internet connections. If we ever decide to close Together, we will stop selling points and give at least 30 days’ notice on the website so you can use your remaining points.</p>

    <h2>7. Our responsibility</h2>
    <p>As far as the law allows, we are not responsible for indirect losses, such as missed moments or lost photos you did not download. If a session fails because of an error on our side, we will put the points back as described in the <a href="#refunds">Refund Policy</a>. Nothing in these terms removes rights you have under the law where you live.</p>

    <h2>8. Ending your use</h2>
    <p>You can stop using Together at any time. We may suspend or close an account that breaks these terms. Unused points are lost when an account is deleted or closed for breaking these terms.</p>

    <h2>9. Changes to these terms</h2>
    <p>We may update these terms as Together grows. When we do, we will change the date at the top of this page; for important changes we will also show a notice on the website. Using Together after a change means you accept the updated terms.</p>

    <h2>10. Law and contact</h2>
    <p>These terms are governed by the laws of Myanmar. Questions about these terms: <Mail />.</p>
  </LegalPage>;
}

export function Privacy() {
  return <LegalPage id="privacy" title="Privacy Policy" intro={<p>This policy explains what information Together collects, why, and what you can ask us to do with it. The short version: <strong>your photos and video never reach our servers.</strong> We only keep what we need to run your account, points and payments. Together is run by {OPERATOR} (Myanmar); contact <Mail />.</p>}>
    <h2>1. What we never collect</h2>
    <ul>
      <li><strong>Photos and live video.</strong> They are captured and edited on your device. In a duo booth they travel directly between the two devices, or, when a direct connection is not possible, through an encrypted relay run by Cloudflare that passes them along without storing them.</li>
      <li>To help you recover from a refresh, the booth keeps a temporary copy of your session in <strong>your own browser</strong> for up to 24 hours. It never leaves your device, and you can turn it off in the booth.</li>
    </ul>

    <h2>2. What we collect</h2>
    <ul>
      <li><strong>Account:</strong> your email address and, if you sign in with Google, the basic profile Google shares (such as your name).</li>
      <li><strong>Points and sessions:</strong> your points balance and history, when sessions were started and completed, and whether you have used your free session.</li>
      <li><strong>Top-ups:</strong> the amount, the transfer receipt image you upload, any payment reference you enter, and whether it was approved. Receipts are visible only to you and the administrator.</li>
      <li><strong>Duo booths:</strong> a temporary room code, who is in the room and whether you are ready or connected. Rooms end automatically within 45 minutes.</li>
      <li><strong>Security:</strong> IP addresses and sign-in attempt counts to protect accounts from password guessing, and a bot check (Cloudflare Turnstile) on sign-in forms.</li>
      <li><strong>Support details:</strong> if you choose to copy and send us the booth’s “support details”, they contain connection measurements only, never photos or account details.</li>
    </ul>

    <h2>3. Why we use it</h2>
    <ul>
      <li>To create and secure your account and sign you in.</li>
      <li>To run booth sessions, connect duo booths and keep track of points.</li>
      <li>To check top-up payments and email you about them.</li>
      <li>To prevent abuse, for example giving the free session only once per email address.</li>
      <li>To answer your questions and fix problems.</li>
    </ul>
    <p>We do not sell your information or use it for advertising.</p>

    <h2>4. Services that help us run Together</h2>
    <p>These providers process information on our behalf, only for the purposes above. Their servers may be in other countries.</p>
    <ul>
      <li><strong>Supabase</strong> — accounts, sign-in and database (including receipt images).</li>
      <li><strong>Vercel</strong> — hosting the website and its servers.</li>
      <li><strong>Cloudflare</strong> — the camera relay for duo booths and the sign-in bot check.</li>
      <li><strong>Resend</strong> — sending account and payment emails.</li>
      <li><strong>Google</strong> — “Continue with Google” sign-in.</li>
    </ul>

    <h2>5. How long we keep it</h2>
    <ul>
      <li>Account, points and session information: while your account exists.</li>
      <li>Duo room information: until the room ends (within 45 minutes).</li>
      <li>After an account is deleted, we keep only what we still need: payment and points records (including receipts) for accounting, fraud prevention and resolving disputes, and a record that the email address has used its free session.</li>
    </ul>

    <h2>6. Your choices</h2>
    <p>Email <Mail /> from your account’s email address to:</p>
    <ul>
      <li>get a copy of the information we hold about you,</li>
      <li>correct something that is wrong, or</li>
      <li><strong>delete your account.</strong> Unused points are lost when an account is deleted, and the free session is not given again to the same email address.</li>
    </ul>
    <p>We aim to reply within 30 days.</p>

    <h2>7. Children</h2>
    <p>Children under 13 may use Together only with a parent’s or guardian’s permission and supervision, and under-18s need permission to buy points. A parent or guardian can contact us at any time to review or delete their child’s account.</p>

    <h2>8. Security</h2>
    <p>Connections to Together are encrypted, each person can only reach their own account data, and administrative access is limited. No system is perfectly secure, but we work to protect your information and will act quickly if something goes wrong.</p>

    <h2>9. Changes</h2>
    <p>If we change this policy, we will update the date at the top, and show a notice on the website for important changes.</p>
  </LegalPage>;
}

export function Refunds() {
  return <LegalPage id="refunds" title="Refund Policy" intro={<p>Points are bought in advance and <strong>never expire</strong>, so you can use them whenever you like. This page explains when points can be put back and what we cannot refund.</p>}>
    <h2>1. Purchased points</h2>
    <p><strong>Points are non-refundable.</strong> Once a top-up is approved, we do not give money back for points, whether they are used or unused. Please choose the amount you need.</p>

    <h2>2. When we put points back</h2>
    <p>If a session was charged but could not be completed because of a problem on our side, we will add the points back to your account. For example:</p>
    <ul>
      <li>a website error stopped you from editing or downloading a session you paid for,</li>
      <li>you were charged twice for the same session, or</li>
      <li>points were charged when they should not have been.</li>
    </ul>
    <p>Corrections are made as points, not money.</p>

    <h2>3. What is not covered</h2>
    <ul>
      <li>Changing your mind, or not using points you bought.</li>
      <li>Leaving a booth or ending a session early, or the other person leaving.</li>
      <li>Problems caused by your own device, camera permissions or internet connection.</li>
      <li>The free session, which has no cash value.</li>
    </ul>

    <h2>4. Top-up problems</h2>
    <p>If you transferred money but your points have not appeared, or the amount looks wrong, email us with your account email, the date and the payment reference. We check every transfer by hand and will sort it out with you.</p>

    <h2>5. If Together closes</h2>
    <p>If we decide to close Together, we will stop selling points and give at least 30 days’ notice on the website so you can use your remaining points.</p>

    <h2>6. How to ask</h2>
    <p>Email <Mail /> from your account’s email address, as soon as possible after the problem, with the date and a short description (a screenshot helps). We aim to reply within a few days.</p>
  </LegalPage>;
}
