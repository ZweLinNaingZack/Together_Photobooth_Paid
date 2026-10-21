import { Heading } from './shared';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';
import { Icon } from '../components/Icon';

export function SourceScreen({ mode, onChoose, onBack }: { mode: 'solo' | 'duo'; onChoose: (source: 'camera' | 'upload') => void; onBack: () => void }) {
  const t = useT();
  return <><Heading eyebrow={t(mode === 'duo' ? 'source.eyebrow.duo' : 'source.eyebrow.solo')} title={<Rich text={t('source.title')} />} note={t(mode === 'duo' ? 'source.note.duo' : 'source.note.solo')} />
    <div className="source-options">
      <button className="source-option" onClick={() => onChoose('camera')}><span className="mode-icon" aria-hidden="true"><Icon name="camera" size={26} /></span><span className="eyebrow">{t('source.camera.eyebrow')}</span><strong>{t('source.camera.title')}</strong><p>{t('source.camera.text')}</p><span className="source-action">{t('source.camera.action')}<Icon name="arrowRight" size={18} /></span></button>
      <button className="source-option" onClick={() => onChoose('upload')}><span className="mode-icon" aria-hidden="true"><Icon name="image" size={26} /></span><span className="eyebrow">{t('source.upload.eyebrow')}</span><strong>{t('source.upload.title')}</strong><p>{t('source.upload.text')}</p><span className="source-action">{t('source.upload.action')}<Icon name="arrowRight" size={18} /></span></button>
    </div><div className="step-actions"><button className="text-button back-step" onClick={onBack}><Icon name="arrowLeft" size={16} />{t('source.back')}</button></div>
  </>;
}
