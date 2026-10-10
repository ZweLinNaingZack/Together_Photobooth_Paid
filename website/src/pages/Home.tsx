import { LegalLinks } from './LegalLinks';
import { DecorativeIcon } from '../components/DecorativeIcon';
import { HeroArt } from '../components/HeroArt';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';

// The five questions in the FAQ, in order. Each has a 'home.faq.qN' and 'home.faq.aN' text.
const FAQ = [1, 2, 3, 4, 5] as const;

export function Home() {
  const t = useT();
  return <div id="home">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="eyebrow"><span className="tiny-star"><DecorativeIcon /></span> {t('home.eyebrow')}</div>
        <h1 id="hero-title"><Rich text={t('home.title1')} /><br /><Rich text={t('home.title2')} /><br /><span className="last-line"><Rich text={t('home.title3')} /><span className="title-star" aria-hidden="true"><DecorativeIcon /></span></span></h1>
        <p>{t('home.lead1')}<br className="desktop-break" /> {t('home.lead2')}</p>
        <a className="primary" href="#booth">{t('common.takePhotos')}</a>
        <div className="hero-note"><span aria-hidden="true">♡</span> {t('home.heroNote')}</div>
      </div>
      <HeroArt />
    </section>
    <div className="ribbon" aria-label={t('home.ribbonLabel')}>
      <span>{t('home.ribbon1')}</span><b aria-hidden="true"><DecorativeIcon /></b>
      <span>{t('home.ribbon2')}</span><b aria-hidden="true"><DecorativeIcon /></b>
      <span>{t('home.ribbon3')}</span><b aria-hidden="true"><DecorativeIcon /></b>
    </div>
    <section id="how-it-works" className="how">
      <div className="section-intro"><div className="eyebrow">{t('home.how.eyebrow')}</div><h2><Rich text={t('home.how.title')} /></h2><p><Rich text={t('home.how.lead')} /></p></div>
      <div className="steps">
        <article><span className="step-number">01</span><div><h3>{t('home.step1.title')}</h3><p>{t('home.step1.text')}</p></div><span className="step-icon" aria-hidden="true"><DecorativeIcon arrow /></span></article>
        <article><span className="step-number">02</span><div><h3>{t('home.step2.title')}</h3><p>{t('home.step2.text')}</p></div><span className="step-icon" aria-hidden="true"><DecorativeIcon /></span></article>
        <article><span className="step-number">03</span><div><h3>{t('home.step3.title')}</h3><p>{t('home.step3.text')}</p></div><span className="step-icon" aria-hidden="true">♡</span></article>
      </div>
    </section>
    <section className="closing"><div className="eyebrow">{t('home.closing.eyebrow')}</div><h2><Rich text={t('home.closing.title')} /></h2><a className="primary" href="#booth">{t('common.takePhotos')}</a></section>
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="faq-intro"><div className="eyebrow">{t('home.faq.eyebrow')}</div><h2 id="faq-title"><Rich text={t('home.faq.title')} /></h2><p>{t('home.faq.lead')}</p></div>
      <div className="faq-list">
        {FAQ.map(n => <details key={n}><summary>{t(`home.faq.q${n}`)}<span aria-hidden="true">+</span></summary><div className="faq-answer"><p><Rich text={t(`home.faq.a${n}`)} /></p></div></details>)}
      </div>
    </section>
    <footer><a className="wordmark" href="#">together<span className="brand-dot"><DecorativeIcon /></span></a><span>{t('home.footer')}</span><LegalLinks /><span className="prototype-label">© 2026 TOGETHER</span></footer>
  </div>;
}
