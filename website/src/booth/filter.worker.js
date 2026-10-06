import {filterPixels} from './core.js';
self.onmessage=event=>{const {id,buffer,filter,seed}=event.data;const pixels=new Uint8ClampedArray(buffer);filterPixels(pixels,filter,seed);self.postMessage({id,buffer:pixels.buffer},[pixels.buffer]);};
