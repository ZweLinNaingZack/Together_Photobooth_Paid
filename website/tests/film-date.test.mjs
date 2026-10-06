import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDate,filmDateRegion,drawFilmDate} from '../src/booth/filmDate.js';
test('film date uses the device calendar day and four-digit year',()=>{
 assert.equal(localDate(new Date(2026,9,7,0,1)),'07.10.2026');
 assert.equal(localDate(new Date(2026,11,31,23,59)),'31.12.2026');
});
test('every film variant replaces its old date at the same scaled position',()=>{
 for(const key of ['film-negative',...['b','c','d','e','g','k'].map(k=>'sasha-film-'+k)]){
  const calls=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:()=>true});
  const r=filmDateRegion(key);assert.ok(r);
  drawFilmDate(ctx,{crop:[248,20,528,1494]},key,2,'07.10.2026');
  assert.deepEqual(calls.find(c=>c[0]==='fillRect'),['fillRect',r.x,r.y,r.w,r.h]);
  assert.equal(calls.find(c=>c[0]==='fillText')[1],'07.10.2026');
  assert.deepEqual(calls.find(c=>c[0]==='translate'),['translate',-496,-40]);
 }
 assert.equal(filmDateRegion('music-player-a'),null);
});
