import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import {cardDesigns} from '../src/booth/designs.ts';
import {loadFrame,thumbnailUrl} from '../src/booth/frameAssets.ts';
import {musicTitles,trackTitle,drawMusicTitle} from '../src/booth/musicTitle.js';

test('every selectable frame has a small independent thumbnail',async()=>{
 for(const key of Object.keys(cardDesigns)) {
   const info=await stat(new URL(`../public${thumbnailUrl(key)}`,import.meta.url));
   assert.ok(info.size>0 && info.size<30000,`${key} thumbnail is compact`);
 }
});
test('artwork loading shares in-flight requests and permits retry after failure',async()=>{
 const original=globalThis.Image;const images=[];
 globalThis.Image=class {set src(value){this.url=value;images.push(this);}};
 try{
   const a=loadFrame('/test-success.png'),b=loadFrame('/test-success.png');
   assert.equal(a,b);assert.equal(images.length,1);images[0].onload();await a;
   assert.equal(loadFrame('/test-success.png'),a);
   const fail=loadFrame('/test-fail.png');images[1].onerror();await assert.rejects(fail);
   const retry=loadFrame('/test-fail.png');assert.notEqual(retry,fail);images[2].onload();await retry;
 }finally{globalThis.Image=original;}
});
test('music titles have a default, bounded Unicode length, and fit their safe artwork region',()=>{
 assert.equal(trackTitle('  '),'Our little moment');assert.equal(Array.from(trackTitle('🎵'.repeat(100))).length,60);
 for(const [key,region] of Object.entries(musicTitles)){
   const design=cardDesigns[key];assert.ok(region.x+region.w<=design.size[0]);assert.ok(region.y+region.h<=design.size[1]);
   let output;const ctx={save(){},restore(){},translate(){},scale(){},drawImage(){},measureText(t){return{width:t.length*parseFloat(this.font.split(' ')[1])};},fillText(...args){output=args;}};
   drawMusicTitle(ctx,{},design,key,'W'.repeat(60),1);
   assert.equal(output[0].length,60);assert.equal(output[3],region.w);assert.ok(parseFloat(ctx.font.split(' ')[1])<=region.size);
 }
});
