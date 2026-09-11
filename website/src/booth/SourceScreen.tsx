import { Heading } from './shared';
export function SourceScreen({ mode, onChoose, onBack }: { mode: 'solo' | 'duo'; onChoose: (source: 'camera' | 'upload') => void; onBack: () => void }) {
  return <><Heading eyebrow={mode === 'duo' ? 'YOUR SHARED KEEPSAKE' : 'YOUR MOMENTS, YOUR WAY'} title={<>Start fresh. <em>Or look back.</em></>} note={mode === 'duo' ? 'Choose your photo source, then a frame. Your invitation will be ready after that.' : 'Take a new set of photos, or turn favorites from your gallery into a keepsake.'} />
    <div className="source-options">
      <button className="source-option" onClick={() => onChoose('camera')}><span className="eyebrow">MAKE A NEW MEMORY</span><strong>Take photos</strong><p>Step into the booth with your camera. Choose a timer, add a little flash, and strike a pose.</p><span className="source-action">Use the photobooth</span></button>
      <button className="source-option" onClick={() => onChoose('upload')}><span className="eyebrow">KEEP A FAVORITE MEMORY</span><strong>Upload photos</strong><p>Bring photos from your device. Arrange them in your chosen design and make them yours.</p><span className="source-action">Choose existing photos</span></button>
    </div><div className="step-actions"><button className="text-button" onClick={onBack}>Change layout</button></div>
  </>;
}
