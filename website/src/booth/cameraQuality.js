import {jpegDimensions} from './peerPhoto.js';
export const cameraConstraints={video:{facingMode:'user',width:{ideal:1920},height:{ideal:1440},frameRate:{ideal:24,max:30}},audio:false};
/** @type {MediaStream|null} */
let warm=null;
let expiry;
let generation=0;
export async function prepareCamera(){clearTimeout(expiry);if(warm?.active)return warm;const request=++generation;const stream=await navigator.mediaDevices.getUserMedia(cameraConstraints);if(request!==generation){stream.getTracks().forEach(t=>t.stop());throw Error('Camera preparation was cancelled.');}warm=stream;return warm;}
export function takePreparedCamera(){clearTimeout(expiry);const stream=warm;warm=null;return stream?.active?stream:null;}
export function expirePreparedCamera(){expiry=setTimeout(()=>{generation++;warm?.getTracks().forEach(t=>t.stop());warm=null;},500);}
/** @param {HTMLVideoElement|null} video @param {boolean} mirrored @param {number|null} ratio */
export function snapshot(video,mirrored,ratio=null,maxEdge=1920){
 if(!video?.videoWidth||video.readyState<2)throw Error('Wait for your camera to finish warming up.');
 const sw=video.videoWidth,sh=video.videoHeight;
 const target=ratio||sw/sh,cw=Math.min(sw,sh*target),ch=cw/target,scale=Math.min(1,maxEdge/Math.max(cw,ch));
 const canvas=document.createElement('canvas');canvas.width=Math.round(cw*scale);canvas.height=Math.round(ch*scale);
 const ctx=canvas.getContext('2d');if(mirrored){ctx.translate(canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(video,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,canvas.width,canvas.height);
 const data=canvas.toDataURL('image/jpeg',.95);canvas.width=canvas.height=1;return data;
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
  return canvas.toDataURL('image/jpeg',.95);
 }finally{images.forEach(i=>{i.onload=null;i.onerror=null;i.src='';});if(canvas)canvas.width=canvas.height=1;}
}
