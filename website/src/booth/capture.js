import { captureTargets } from './core.js';

export function waitForCapture(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

// The controller knows photo timing; React owns the pictures and visible controls.
export async function captureSequence({ shots, count, retake, method, seconds, signal, takeShot, onShot, onCountdown, onTaking, flash = false, onFlash = (_active) => {}, wait = waitForCapture }) {
  const targets = captureTargets(shots, count, retake, method === 'manual');
  for (const [position, target] of targets.entries()) {
    signal.throwIfAborted();
    onTaking(target);
    for (let remaining = method === 'manual' ? 0 : seconds; remaining > 0; remaining--) {
      onCountdown(remaining);
      await wait(1000, signal);
      signal.throwIfAborted();
    }
    onCountdown(null);
    let photo;
    try {
      if (flash) {
        onFlash(true);
        // Allow the screen to paint and illuminate the subject before sampling the camera.
        await wait(450, signal);
        signal.throwIfAborted();
      }
      photo = await takeShot();
    } finally {
      if (flash) onFlash(false);
    }
    signal.throwIfAborted();
    await onShot(target, photo);
    if (position < targets.length - 1) {
      onCountdown('♡');
      await wait(500, signal);
    }
  }
}
