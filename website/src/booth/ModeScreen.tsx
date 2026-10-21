import { Heading } from './shared';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { Icon } from '../components/Icon';

export type BoothMode = 'solo' | 'duo';

export function ModeScreen({ onChoose }: { onChoose: (mode: BoothMode) => void }) {
  const t = useT();
  return <><Heading eyebrow={t('mode.eyebrow')} title={<Rich text={t('mode.title')} />} note={t('mode.note')} />
    <div className="mode-options">
      <button className="mode-option solo-option" onClick={() => onChoose('solo')}><span className="mode-icon" aria-hidden="true"><Icon name="user" size={26} /></span><span className="eyebrow">{t('mode.solo.eyebrow')}</span><strong>{t('mode.solo.title')}</strong><p>{t('mode.solo.text')}</p><span className="mode-action">{t('mode.solo.action')}<Icon name="arrowRight" size={18} /></span></button>
      <button className="mode-option duo-option" onClick={() => onChoose('duo')}>
        {/* "Recommended" badge in the top corner: Duo is the main thing Together is made for. */}
        <span className="mode-badge"><Icon name="sparkles" size={14} />{t('mode.duo.badge')}</span>
        <span className="mode-icon" aria-hidden="true"><Icon name="users" size={26} /></span><span className="eyebrow">{t('mode.duo.eyebrow')}</span><strong>{t('mode.duo.title')}</strong><p>{t('mode.duo.text')}</p><span className="mode-action">{t('mode.duo.action')}<Icon name="arrowRight" size={18} /></span></button>
    </div>
  </>;
}
