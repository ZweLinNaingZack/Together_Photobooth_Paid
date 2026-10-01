// One explicit confirmation owns the debit and releases navigation only after
// the server commits it. Failure leaves the same request open for a safe retry.
export function createEditingConfirmation(charge, changed) {
  let pending = null, busy = false, sequence = 0;
  function publish(error = '') { changed({ open: !!pending, busy, error }); }
  return {
    request() {
      if (!pending) {
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        pending = { promise, resolve }; publish();
      }
      return pending.promise;
    },
    async confirm() {
      if (!pending || busy) return;
      const current = pending, version = sequence;
      busy = true; publish();
      try {
        await charge();
        if (sequence !== version) return;
        pending = null; busy = false; publish(); current.resolve(true);
      } catch (error) {
        if (sequence !== version) return;
        busy = false; publish(error instanceof Error ? error.message : 'Please retry confirmation.');
      }
    },
    cancel() {
      if (busy) return;
      const current = pending; pending = null; publish(); current?.resolve(false);
    },
    dispose() { sequence++; const current = pending; pending = null; busy = false; current?.resolve(false); },
  };
}
