import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validActiveSession} from '../src/booth/recoveryStore.js';

// The pre-edit record is user-controlled browser data, so it is validated before use.
const photo='data:image/jpeg;base64,AAAA';
const record=(patch={},card={})=>({version:1,expires:Date.now()+60_000,sessionId:'abc',mode:'solo',source:'camera',step:'session',photosSaved:true,
  card:{layout:'A',shots:[photo],filter:'original',caption:'hi',...card},...patch});

test('accepts a partially captured Solo session',()=>{
  assert.equal(validActiveSession(record()),true);
  assert.equal(validActiveSession(record({}, {shots:[]})),true,'no photos yet (or auto-save off)');
  assert.equal(validActiveSession(record({}, {shots:[photo,undefined,photo]})),true,'an empty middle slot after a retake');
});
test('rejects expired, foreign or malformed records',()=>{
  assert.equal(validActiveSession(record({expires:Date.now()-1})),false);
  assert.equal(validActiveSession(record({mode:'duo'})),false,'duo is not restored from this record');
  assert.equal(validActiveSession(record({step:'upload'})),false,'step must match the source');
  assert.equal(validActiveSession(record({sessionId:''})),false);
  assert.equal(validActiveSession(record({}, {shots:['javascript:alert(1)']})),false,'only image data URLs');
  assert.equal(validActiveSession(record({}, {shots:[photo,photo,photo,photo,photo]})),false,'more photos than the layout holds');
  assert.equal(validActiveSession(record({}, {filter:'unknown'})),false);
  assert.equal(validActiveSession(null),false);
});

const room=(patch={})=>({code:'ABCDEF',token:'a'.repeat(48),role:'host',...patch});
test('accepts Duo room and Duo upload records',()=>{
  assert.equal(validActiveSession(record({mode:'duo',step:'room',room:room()})),true);
  assert.equal(validActiveSession(record({mode:'duo',step:'session',sessionId:'',room:room({role:'guest',invite:'b'.repeat(48)})})),true,'guests have no reservation');
  assert.equal(validActiveSession(record({mode:'duo',source:'upload',step:'upload',duoUploads:[photo,'',photo]})),true);
});
test('rejects tampered Duo records',()=>{
  assert.equal(validActiveSession(record({mode:'duo',step:'room',sessionId:'',room:room()})),false,'a host must have a reservation');
  assert.equal(validActiveSession(record({mode:'duo',step:'room',room:room({token:'short'})})),false);
  assert.equal(validActiveSession(record({mode:'duo',step:'room',room:room({code:'abc'})})),false);
  assert.equal(validActiveSession(record({mode:'duo',step:'room',room:room({role:'admin'})})),false);
  assert.equal(validActiveSession(record({mode:'duo',step:'room'})),false,'a duo camera record needs its room');
  assert.equal(validActiveSession(record({room:room()})),false,'solo records never carry a room');
  assert.equal(validActiveSession(record({mode:'duo',source:'upload',step:'upload',duoUploads:Array(7).fill(photo)})),false,'more than two sides');
});
