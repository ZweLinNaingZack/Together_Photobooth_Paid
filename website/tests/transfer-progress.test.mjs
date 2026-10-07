import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transferProgress} from '../src/booth/transferProgress.js';
test('slow transfers continue beyond twenty seconds while draining',()=>{
 let now=0;const p=transferProgress(()=>now);
 for(let i=0;i<10;i++){p.sent(48000);now+=5000;assert.doesNotThrow(()=>p.check(16000));}
});
test('stalled and indefinitely progressing transfers remain bounded',()=>{
 let now=0;const p=transferProgress(()=>now);p.sent(48000);
 now=20000;assert.throws(()=>p.check(48000),/retry photo sync/);
 now=0;const q=transferProgress(()=>now);
 for(let i=0;i<23;i++){q.sent(48000);now+=5000;q.check(16000);}
 now=120000;assert.throws(()=>q.check(0),/retry photo sync/);
});
