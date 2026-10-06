// Generated locally: no downloads, microphone access or recorded audio.
let context;
export function unlockCameraSound(){
 try{context ||= new AudioContext();if(context.state==='suspended')void context.resume().catch(()=>{});}catch{/* Sound is optional on unsupported devices. */}
}
export function cameraSound(kind){
 if(!context||context.state!=='running')return;
 try{
  const start=context.currentTime;
  if(kind==='shutter'){
   const length=Math.floor(context.sampleRate*.09),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.16;source.connect(gain);gain.connect(context.destination);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};
  }else{
   const tone=context.createOscillator(),gain=context.createGain();tone.frequency.value=kind===1?1100:800;
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.09,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+.13);
   tone.connect(gain);gain.connect(context.destination);tone.start();tone.stop(start+.14);tone.onended=()=>{tone.disconnect();gain.disconnect();};
  }
 }catch{/* Audio must never prevent taking a photo. */}
}
