import {filterPixels} from './core.js';
let worker,sequence=0;
const pending=new Map();
function resetWorker(){worker?.terminate();worker=null;for(const resolve of pending.values())resolve(null);pending.clear();}
export async function applyFilter(image,filter,seed){
 if(filter==='original')return image;
 try{
  if(!worker){worker=new Worker(new URL('./filter.worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const resolve=pending.get(data.id);pending.delete(data.id);resolve?.(data.buffer);};worker.onerror=resetWorker;}
  const id=++sequence,copy=image.data.slice();
  const buffer=await new Promise(resolve=>{const timer=setTimeout(resetWorker,10000);pending.set(id,value=>{clearTimeout(timer);resolve(value);});worker.postMessage({id,buffer:copy.buffer,filter,seed},[copy.buffer]);});
  if(buffer){image.data.set(new Uint8ClampedArray(buffer));return image;}
 }catch{/* Unsupported workers fall back to the same deterministic filter. */}
 filterPixels(image.data,filter,seed);return image;
}
