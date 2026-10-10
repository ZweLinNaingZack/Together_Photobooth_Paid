import { Heading } from './shared';
import { useT } from '../i18n';
import { Rich } from '../i18n/Rich';

export function DuoChoice({ onCreate, onJoin, onBack }: { onCreate: () => void; onJoin: () => void; onBack: () => void }) {
  const t = useT();
  return <><Heading eyebrow={t('duo.eyebrow')} title={<Rich text={t('duo.title')} />} note={t('duo.note')} />
    <div className="source-options">
      <button className="source-option" onClick={onCreate}><span className="eyebrow">{t('duo.create.eyebrow')}</span><strong>{t('duo.create.title')}</strong><p>{t('duo.create.text')}</p><span className="source-action">{t('duo.create.action')}</span></button>
      <button className="source-option" onClick={onJoin}><span className="eyebrow">{t('duo.join.eyebrow')}</span><strong>{t('duo.join.title')}</strong><p>{t('duo.join.text')}</p><span className="source-action">{t('duo.join.action')}</span></button>
    </div><div className="step-actions"><button className="text-button" onClick={onBack}>{t('duo.back')}</button></div></>;
}
