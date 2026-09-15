// One in-flight write per camera prevents ICE bursts from contending for the
// same persisted room. Descriptions take priority over queued ICE candidates.
export function createSignalQueue(post, stopped = () => false) {
  const pending = [];
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending.length) {
        const priority = pending.findIndex(item => item.message.type !== 'candidate');
        const [item] = pending.splice(priority < 0 ? 0 : priority, 1);
        try {
          if (!stopped()) await sendSignal(post, item.message, stopped);
          item.resolve();
        } catch (error) { item.reject(error); }
      }
    } finally { running = false; }
  }
  return message => new Promise((resolve, reject) => {
    pending.push({ message, resolve, reject });
    void drain();
  });
}

// Retry transient tunnel failures with the same message ID. The room service
// deduplicates that ID when a response is lost after accepting a message.
export async function sendSignal(post, message, stopped = () => false, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (stopped()) return;
    try { await post(message); return; }
    catch (error) {
      failure = error;
      if (attempt < 2) await wait(attempt === 0 ? 300 : 1000);
    }
  }
  if (!stopped()) throw failure;
}
