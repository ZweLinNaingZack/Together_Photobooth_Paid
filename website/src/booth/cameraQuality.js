import {jpegDimensions} from './peerPhoto.js';
export const cameraConstraints={video:{facingMode:'user',width:{ideal:1920},height:{ideal:1440},frameRate:{ideal:24,max:30}},audio:false};
/** @type {MediaStream|null} */
let warm=null;
let expiry;
let generation=0;
export async function prepareCamera(){clearTimeout(expiry);if(warm?.active)return warm;const request=++generation;const stream=await navigator.mediaDevices.getUserMedia(cameraConstraints);if(request!==generation){stream.getTracks().forEach(t=>t.stop());throw Error('Camera preparation was cancelled.');}warm=stream;return warm;}
export function takePreparedCamera(){clearTimeout(expiry);const stream=warm;warm=null;return stream?.active?stream:null;}
export function expirePreparedCamera(){expiry=setTimeout(()=>{generation++;warm?.getTracks().forEach(t=>t.stop());warm=null;},500);}
/**
 * Duo photos travel between phones, so each half is sent smaller than a solo photo.
 * 1280 px at JPEG 0.85 is still above what the largest card needs per half (~810 px),
 * and is ~6–8× less data than 1920 px at 0.95, so it gets through slow or relayed connections.
 */
export const DUO_ORIGINAL={maxEdge:1280,quality:.85};
/** @param {HTMLVideoElement|null} video @param {boolean} mirrored @param {number|null} ratio @param {number} maxEdge @param {number} quality */
export function snapshot(video,mirrored,ratio=null,maxEdge=1920,quality=.95){
 if(!video?.videoWidth||video.readyState<2)throw Error('Wait for your camera to finish warming up.');
 const sw=video.videoWidth,sh=video.videoHeight;
 const target=ratio||sw/sh,cw=Math.min(sw,sh*target),ch=cw/target,scale=Math.min(1,maxEdge/Math.max(cw,ch));
 const canvas=document.createElement('canvas');canvas.width=Math.round(cw*scale);canvas.height=Math.round(ch*scale);
 const ctx=canvas.getContext('2d');if(mirrored){ctx.translate(canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(video,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,canvas.width,canvas.height);
 const data=canvas.toDataURL('image/jpeg',quality);canvas.width=canvas.height=1;return data;
}
export async function combinePortraits(left,right){
 // Validate both inputs before starting either decoder, including direct callers.
 [left,right].forEach(jpegDimensions);
 const images=[new Image(),new Image()];let canvas;
 try{
  await Promise.all(images.map((image,i)=>new Promise((resolve,reject)=>{image.onload=()=>resolve(image);image.onerror=reject;image.src=[left,right][i];})));
  if(images.some(i=>!i.naturalWidth||!i.naturalHeight||i.naturalWidth>8192||i.naturalHeight>8192||i.naturalWidth*i.naturalHeight>16000000))throw Error('The shared photo is too large. Please retake it.');
  const width=Math.min(1440,Math.max(...images.map(i=>i.naturalWidth))),height=Math.round(width*images[0].naturalHeight/images[0].naturalWidth);
  const scale=Math.min(1,2880/height);
  canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.floor(width*scale)*2);canvas.height=Math.max(1,Math.floor(height*scale));
  const ctx=canvas.getContext('2d');images.forEach((image,i)=>ctx.drawImage(image,i*canvas.width/2,0,canvas.width/2,canvas.height));
  return canvas.toDataURL('image/jpeg',.9);   // combined locally; also re-sent after a reconnect, so kept lean
 }finally{images.forEach(i=>{i.onload=null;i.onerror=null;i.src='';});if(canvas)canvas.width=canvas.height=1;}
}

// ---------------------------------------------------------------------------
// Front / back camera choice on phones.
// Phones expose every lens separately (ultra wide, telephoto, "dual"/"triple"
// virtual cameras). We only offer Front and Back, and Back always means the
// main lens, so photos are not distorted or unexpectedly zoomed.
// ---------------------------------------------------------------------------
/** @typedef {'user'|'environment'} Facing */

/** Labels of lenses we never want for "Back": ultra wide, zoom, macro, depth, or iOS virtual multi-lens cameras. */
const specialLens=/ultra|tele|zoom|macro|depth|dual|triple|infrared|\bir\b/i;
const backLabel=/back|rear|environment/i;

/** @param {string} label */
export function isSpecialLens(label){return specialLens.test(label||'');}

/** @param {{kind:string,label:string}[]} devices True when the device reports a back camera (labels appear after camera permission). */
export function hasBackCamera(devices){return devices.some(d=>d.kind==='videoinput'&&backLabel.test(d.label));}

/**
 * Pick the main back lens from the device list.
 * iOS names it "Back Camera"; Android names lenses "camera2 0, facing back", where the lowest number is the main one.
 * @param {{kind:string,label:string,deviceId:string}[]} devices
 */
export function pickMainBackCamera(devices){
 const backs=devices.filter(d=>d.kind==='videoinput'&&backLabel.test(d.label)&&!isSpecialLens(d.label));
 const number=d=>{const m=/camera2?\s*(\d+)/i.exec(d.label);return m?Number(m[1]):Number.MAX_SAFE_INTEGER;};
 return backs.sort((a,b)=>number(a)-number(b))[0]||null;
}

/** Camera request for one side, keeping the same resolution/frame-rate targets as before. @param {Facing} facing */
export function facingConstraints(facing){return {audio:false,video:{...cameraConstraints.video,facingMode:{ideal:facing}}};}

/**
 * Open the front or back camera. For the back, if the browser picked a special lens,
 * switch to the main back lens instead.
 * @param {Facing} facing
 */
export async function openFacingCamera(facing){
 let stream=await navigator.mediaDevices.getUserMedia(facingConstraints(facing));
 if(facing!=='environment')return stream;
 const track=stream.getVideoTracks()[0];
 if(!track||!isSpecialLens(track.label))return stream;
 const main=pickMainBackCamera(await navigator.mediaDevices.enumerateDevices());
 if(!main||main.deviceId===track.getSettings().deviceId)return stream;
 stream.getTracks().forEach(t=>t.stop());
 return navigator.mediaDevices.getUserMedia({audio:false,video:{...cameraConstraints.video,facingMode:undefined,deviceId:{exact:main.deviceId}}});
}
