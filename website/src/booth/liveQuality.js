export const previewProfiles=[
 {name:'Low bandwidth',width:640,bitrate:600000,fps:20},
 {name:'Balanced',width:960,bitrate:1400000,fps:24},
 {name:'Clear',width:1280,bitrate:2400000,fps:24},
];
export function createPreviewQuality(){
 let level=1,bad=0,good=0,lastChange=0;
 return {get profile(){return previewProfiles[level];},sample({bandwidth,rtt,loss,cpu},now){
  const poor=cpu||loss>.05||rtt>.6||(Number.isFinite(bandwidth)&&bandwidth<previewProfiles[level].bitrate*1.15);
  const healthy=!poor&&Number.isFinite(bandwidth)&&bandwidth>previewProfiles[Math.min(2,level+1)].bitrate*1.5&&Number.isFinite(rtt)&&rtt<.25&&Number.isFinite(loss)&&loss<.02;
  bad=poor?bad+1:0;good=healthy?good+1:0;
  if(now-lastChange<10000)return false;
  const next=bad>=2?Math.max(0,level-1):good>=5?Math.min(2,level+1):level;
  if(next===level)return false;
  level=next;lastChange=now;bad=good=0;return true;
 }};
}
export function recoveryDelay(attempt){return Math.min(20000,8000*2**attempt);}
export function videoSample(stats,previous=new Map()){
 const next=new Map();let sent='Unavailable',received='Unavailable',loss,rtt,bandwidth,cpu=false;
 const delta=(r,key)=>{const p=previous.get(r.id);return p&&r.timestamp>p.timestamp&&r[key]>=p[key]?(r[key]-p[key])/((r.timestamp-p.timestamp)/1000):undefined;};
 for(const r of stats.values()){
  next.set(r.id,r);
  if(r.type==='outbound-rtp'&&r.kind==='video'){
   const rate=delta(r,'bytesSent');cpu ||= r.qualityLimitationReason==='cpu';
   sent=`${r.frameWidth||'?'} × ${r.frameHeight||'?'}, ${r.framesPerSecond??'?'} fps, ${rate===undefined?'?':Math.round(rate*8/1000)} kbps; limitation: ${['none','cpu','bandwidth','other'].includes(r.qualityLimitationReason)?r.qualityLimitationReason:'unavailable'}`;
  }
  if(r.type==='inbound-rtp'&&r.kind==='video'){
   const rate=delta(r,'bytesReceived'),frames=r.framesPerSecond??delta(r,'framesDecoded');
   received=`${r.frameWidth||'?'} × ${r.frameHeight||'?'}, ${frames===undefined?'?':Math.round(frames)} fps, ${rate===undefined?'?':Math.round(rate*8/1000)} kbps; freezes: ${r.freezeCount??'?'}`;
  }
  if(r.type==='remote-inbound-rtp'&&r.kind==='video'){
   if(Number.isFinite(r.fractionLost))loss=Math.max(0,r.fractionLost);
   if(Number.isFinite(r.roundTripTime))rtt=r.roundTripTime;
  }
  if(r.type==='candidate-pair'&&r.state==='succeeded'&&r.nominated){bandwidth=r.availableOutgoingBitrate;rtt=r.currentRoundTripTime??rtt;}
 }
 return {next,sent,received,loss,rtt,bandwidth,cpu};
}
