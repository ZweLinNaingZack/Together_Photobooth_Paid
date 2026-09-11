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
