import test from 'node:test';
import assert from 'node:assert/strict';
import {audienceMove} from '../../src/components/green-terrain/stadiumFloor.ts';
const floor={x:0,z:0,yaw:0,scale:1};
test('a long sprint cannot cross curved seating or either stage',()=>{
 for(const [start,end,ok] of [
 [[0,15],[200,200],([x,z])=>Math.hypot(x,z)<=27.401],
 [[0,15],[0,-100],([x,z])=>z>=6.44],
 [[12,0],[12,-100],([x,z])=>z>=-15.56],
 [[0,15],[3,15],([x,z])=>Math.abs(x-3)<1e-6 && z===15]]){
 assert.ok(ok(audienceMove(...start,...end,floor)));
 }
});
test('relocated, rotated, resized stadium keeps same walkable stage edge',()=>{
 for(const scale of [.05,2,20]){
 const f={x:55,z:-30,yaw:Math.PI/2,scale};
 const [x,z]=audienceMove(55,-30-12*scale,55-100*scale,-30-12*scale,f);
 assert.ok((x-55)/scale>=-15.56 && (x-55)/scale<-15);assert.ok(Math.abs(z+30+12*scale)<.00001);
 }
});