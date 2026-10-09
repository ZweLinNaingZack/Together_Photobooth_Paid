import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewQuality,videoSample,recoveryDelay,selectedVideoRoute} from '../src/booth/liveQuality.js';
test('route diagnostics support selected pairs without nominated and distinguish TURN transport',()=>{
 const stats=new Map([
 ['t',{type:'transport',selectedCandidatePairId:'p'}],
 ['p',{type:'candidate-pair',localCandidateId:'l',remoteCandidateId:'r',currentRoundTripTime:.169}],
 ['l',{candidateType:'relay',protocol:'udp',relayProtocol:'tls',address:'private-address',url:'private-url'}],
 ['r',{candidateType:'prflx'}],
 ]);
 const result=selectedVideoRoute(stats);assert.match(result.route,/relay → prflx \(udp\); local TURN transport: tls/);
 assert.equal(result.roundTrip,'169 ms');assert.ok(!JSON.stringify(result).includes('private-'));
});
test('a new preview starts on Low bandwidth',()=>{assert.equal(createPreviewQuality().profile.name,'Low bandwidth');});
test('bandwidth near the configured cap does not unnecessarily reduce resolution',()=>{
 const q=createPreviewQuality({start:1});
 for(let i=0;i<10;i++)q.sample({bandwidth:1400000,rtt:.16,loss:0},10000+i*2000);
 assert.equal(q.profile.name,'Balanced');
});
test('missing fractionLost uses packet deltas and the selected transport route',()=>{
 const old=new Map([['o',{packetsSent:100}],['r',{timestamp:1000,packetsLost:2}]]);
 const stats=new Map([
 ['o',{id:'o',type:'outbound-rtp',kind:'video',packetsSent:200}],
 ['r',{id:'r',type:'remote-inbound-rtp',kind:'video',localId:'o',timestamp:3000,packetsLost:3}],
 ['active',{id:'active',type:'candidate-pair',state:'succeeded',nominated:true,currentRoundTripTime:.1,availableOutgoingBitrate:5000000}],
 ['old',{id:'old',type:'candidate-pair',state:'succeeded',nominated:true,currentRoundTripTime:2,availableOutgoingBitrate:1000}],
 ['t',{id:'t',type:'transport',selectedCandidatePairId:'active'}],
 ]);
 const sample=videoSample(stats,old);assert.equal(sample.loss,.01);assert.equal(sample.rtt,.1);assert.equal(sample.bandwidth,5000000);
});
test('preview backs off under sustained pressure and improves only with sustained measured headroom',()=>{
 const q=createPreviewQuality({start:1});assert.equal(q.profile.name,'Balanced');
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
