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

import {ackWatch} from '../src/booth/transferProgress.js';
test('waiting for the reply never times out while the queue is still draining',()=>{
 let time=0;const watch=ackWatch(()=>time,20000);
 for(const buffered of [1000000,800000,600000,400000,200000,0]){time+=9000;assert.equal(watch.expired(buffered),false,'slow but moving');}
 time+=19000;assert.equal(watch.expired(0),false);
 time+=2000;assert.equal(watch.expired(0),true,'20 s after the last byte left with no reply');
});
test('a queue that stops moving fails after the stall window',()=>{
 let time=0;const watch=ackWatch(()=>time,20000);watch.expired(500000);
 time+=21000;assert.equal(watch.expired(500000),true);
});
