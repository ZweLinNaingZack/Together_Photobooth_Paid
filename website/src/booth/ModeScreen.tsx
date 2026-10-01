import { Heading } from './shared';

export type BoothMode = 'solo' | 'duo';

export function ModeScreen({ onChoose }: { onChoose: (mode: BoothMode) => void }) {
  return <><Heading eyebrow="WHO’S MAKING THE MEMORY?" title={<>A little moment,<br /><em>your way.</em></>} note="Choose solo or duo, then take new photos or upload favorites." />
    <div className="mode-options">
      <button className="mode-option solo-option" onClick={() => onChoose('solo')}><span className="mode-icon" aria-hidden="true">♡</span><span className="eyebrow">JUST YOU</span><strong>Solo booth</strong><p>Take photos with your own camera, or turn favorites from your gallery into a photocard.</p><span className="mode-action">Make a solo memory</span></button>
      <button className="mode-option duo-option" onClick={() => onChoose('duo')}><span className="mode-icon" aria-hidden="true">♡ ♡</span><span className="eyebrow">YOU AND YOUR PERSON</span><strong>Duo booth</strong><p>Create a booth and invite your person, or join with their party code. Take shared photos live, or upload photos for both sides yourself.</p><span className="mode-action">Create or join a booth</span></button>
    </div>
  </>;
}
