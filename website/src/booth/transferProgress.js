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
