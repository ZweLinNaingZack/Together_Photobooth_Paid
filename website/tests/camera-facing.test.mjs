import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSpecialLens,hasBackCamera,pickMainBackCamera,facingConstraints} from '../src/booth/cameraQuality.js';

const cam=(label,deviceId=label)=>({kind:'videoinput',label,deviceId});
test('special lenses are recognised on iPhone and Android',()=>{
  for(const label of ['Back Ultra Wide Camera','Back Telephoto Camera','Back Dual Wide Camera','Back Triple Camera','Front Ultra Wide Camera','camera2 3, facing back (macro)'])assert.equal(isSpecialLens(label),true,label);
  for(const label of ['Back Camera','Front Camera','camera2 0, facing back'])assert.equal(isSpecialLens(label),false,label);
});
test('Back always resolves to the main lens',()=>{
  assert.equal(pickMainBackCamera([cam('Front Camera'),cam('Back Ultra Wide Camera'),cam('Back Camera'),cam('Back Telephoto Camera'),cam('Back Triple Camera')]).label,'Back Camera');
  assert.equal(pickMainBackCamera([cam('camera2 1, facing front'),cam('camera2 2, facing back'),cam('camera2 0, facing back')]).label,'camera2 0, facing back','lowest Android number is the main lens');
  assert.equal(pickMainBackCamera([cam('Integrated Webcam')]),null);
});
test('only phones with a back camera get the Front / Back choice',()=>{
  assert.equal(hasBackCamera([cam('Front Camera'),cam('Back Camera')]),true);
  assert.equal(hasBackCamera([cam('Integrated Webcam'),cam('USB Camera')]),false,'computers keep the normal camera list');
  assert.equal(hasBackCamera([cam(''),cam('')]),false,'labels are empty before permission');
});
test('each side keeps the same quality targets',()=>{
  const back=facingConstraints('environment');
  assert.deepEqual(back.video.facingMode,{ideal:'environment'});assert.equal(back.video.frameRate.max,30);assert.equal(back.audio,false);
});
