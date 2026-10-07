import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewQuality,videoSample,recoveryDelay} from '../src/booth/liveQuality.js';
test('preview backs off under sustained pressure and improves only with sustained measured headroom',()=>{
 const q=createPreviewQuality();assert.equal(q.profile.name,'Balanced');
 assert.equal(q.sample({cpu:true},10000),false);assert.equal(q.sample({cpu:true},12000),true);assert.equal(q.profile.name,'Low bandwidth');
 for(let i=0;i<10;i++)q.sample({},14000+i*2000);assert.equal(q.profile.name,'Low bandwidth');
 for(let i=0;i<5;i++)q.sample({bandwidth:5000000,rtt:.05,loss:0},40000+i*2000);assert.equal(q.profile.name,'Balanced');
 q.sample({loss:.2},49000);q.sample({loss:.2},50000);assert.equal(q.profile.name,'Balanced','cooldown prevents oscillation');
});
test('statistics use interval deltas and never expose candidate addresses',()=>{
 const old=new Map([['v',{timestamp:1000,bytesReceived:1000,framesDecoded:10}]]);
 const rows=new Map([['v',{id:'v',type:'inbound-rtp',kind:'video',timestamp:3000,bytesReceived:11000,framesDecoded:50,frameWidth:960,frameHeight:720}],['c',{id:'c',type:'local-candidate',address:'private-address'}]]);
 const sample=videoSample(rows,old);assert.match(sample.received,/20 fps, 40 kbps/);assert.equal(sample.loss,undefined);assert.ok(!sample.received.includes('private-address'));
 assert.deepEqual([0,1,2,3].map(recoveryDelay),[8000,16000,20000,20000]);
});
