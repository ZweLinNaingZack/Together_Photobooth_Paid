import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverCrop,panOffset,reconcileOffsets} from '../src/booth/photoPosition.js';
import {cardDesigns} from '../src/booth/designs.ts';
import {layouts} from '../src/booth/core.js';
test('all artwork and classic slots cover portrait and landscape photos at every pan boundary',()=>{
 const slots=[...Object.values(cardDesigns).flatMap(d=>d.slots),...Object.values(layouts).flatMap(l=>l.slots.map(s=>({w:s.w*l.width,h:s.h*l.height})))];
 for(const slot of slots)for(const [iw,ih] of [[4000,3000],[3000,4000],[1000,1000]])for(const x of [-1,0,.5,1,2])for(const y of [-1,0,.5,1,2]){
  const c=coverCrop(iw,ih,slot.w,slot.h,{x,y});assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=iw+.001&&c.y+c.h<=ih+.001);assert.ok(Math.abs(c.w/c.h-slot.w/slot.h)<.001);
 }
});
test('dragging clamps and gives identical normalized crop at preview and export sizes',()=>{
 const offset=panOffset({x:.5,y:.5},-50,200,4000,3000,200,300);
 assert.ok(offset.x>.5);assert.equal(offset.y,.5);
 assert.deepEqual(panOffset(offset,99999,-99999,4000,3000,200,300),{x:0,y:.5});
 assert.deepEqual(coverCrop(4000,3000,200,300,offset),{...coverCrop(4000,3000,2000,3000,offset),scale:.1});
});
test('offsets follow reordered photos and replacement photos start centered',()=>{
 assert.deepEqual(reconcileOffsets(['a','b'],[{x:0,y:1},{x:1,y:0}],['b','new','a']),[{x:1,y:0},{x:.5,y:.5},{x:0,y:1}]);
});
