import type { CSSProperties } from 'react';
import { DecorativeIcon } from '../components/DecorativeIcon';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { Icon } from '../components/Icon';

export function About() {
  const t = useT();
  return <section id="about" className="about-page" aria-labelledby="about-title">
    <a className="back-link" href="#"><Icon name="arrowLeft" size={16} />{t('common.backHome')}</a>
    <div className="about-intro"><div className="eyebrow">{t('about.eyebrow')}</div><h1 id="about-title"><Rich text={t('about.title')} /></h1><p><Rich text={t('about.lead')} /></p></div>
    <div className="about-story reveal"><span className="about-mark" aria-hidden="true"><DecorativeIcon /></span><div><h2><Rich text={t('about.story.title')} /></h2><p>{t('about.story.p1')}</p><p>{t('about.story.p2')}</p></div></div>
    <div className="about-notes">
      <article className="reveal"><span className="step-number">01</span><h3>{t('about.note1.title')}</h3><p>{t('about.note1.text')}</p></article>
      <article className="reveal" style={{ '--reveal-delay': '90ms' } as CSSProperties}><span className="step-number">02</span><h3>{t('about.note2.title')}</h3><p>{t('about.note2.text')}</p></article>
      <article className="reveal" style={{ '--reveal-delay': '180ms' } as CSSProperties}><span className="step-number">03</span><h3>{t('about.note3.title')}</h3><p>{t('about.note3.text')}</p></article>
    </div>
    <div className="about-preview reveal"><div><div className="eyebrow">{t('about.today.eyebrow')}</div><h2><Rich text={t('about.today.title')} /></h2><p>{t('about.today.text')}</p></div><a className="primary" href="#booth">{t('common.takePhotos')}<Icon name="arrowRight" size={18} className="cta-arrow" /></a></div>
  </section>;
}
