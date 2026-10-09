// Allow slow, progressing uploads without allowing a stalled queue to hang forever.
export function transferProgress(now=Date.now, stallMs=20000, totalMs=120000){
 const started=now();let progressed=started,lastBuffered=0;
 return {
  sent(buffered){lastBuffered=buffered;},
  check(buffered){
   const time=now();
   if(buffered<lastBuffered)progressed=time;
   lastBuffered=buffered;
   if(time-started>=totalMs||time-progressed>=stallMs)
    throw Error('Photo transfer paused. Keep both pages open and retry photo sync.');
  },
 };
}

/**
 * Waiting for the partner's "received" reply after the last chunk was queued.
 * The reply cannot arrive until everything still buffered has left this phone, so the clock
 * only runs once the buffer stops shrinking: a slow-but-moving upload never times out,
 * and a truly stuck one fails stallMs after its last byte left.
 */
export function ackWatch(now=Date.now,stallMs=20000){
 let last=now(),previous=Infinity;
 return {expired(buffered){const time=now();if(buffered<previous)last=time;previous=buffered;return time-last>=stallMs;}};
}
