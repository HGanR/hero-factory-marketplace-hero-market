import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../public/mobile/theme-mode.js',import.meta.url),'utf8');
function harness(stored='day',unavailable=false) {
 const writes=[],nodes=new Map();const body={dataset:{}};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',setAttribute(k,v){this[k]=v;},addEventListener(k,f){this[k]=f;}});return nodes.get(id);};
 const context={document:{body,getElementById:node},localStorage:{getItem:key=>{assert.equal(key,'smart-trust-mobile-view-mode');if(unavailable)throw Error('blocked');return stored;},setItem:(key,value)=>{if(unavailable)throw Error('blocked');writes.push({key,value});}}};
 vm.runInNewContext(source,context);return {body,node,writes};
}
test('both day/night controls agree and store only a fixed non-sensitive display value',()=>{
 const h=harness();assert.equal(h.body.dataset.viewMode,'day');h.node('profileViewMode').click();assert.equal(h.node('appearanceViewMode').textContent,'NIGHT');assert.equal(h.node('appearanceViewMode')['aria-checked'],'true');
 h.node('appearanceViewMode').click();assert.equal(h.node('profileViewMode').textContent,'DAY');assert.deepEqual(h.writes,[{key:'smart-trust-mobile-view-mode',value:'night'},{key:'smart-trust-mobile-view-mode',value:'day'}]);
});
test('saved mode restores; malformed values and unavailable storage have a working fallback',()=>{
 assert.equal(harness('night').body.dataset.viewMode,'night');assert.equal(harness('{"userId":7}').body.dataset.viewMode,'day');
 const h=harness(null,true);h.node('profileViewMode').click();assert.equal(h.body.dataset.viewMode,'night');assert.equal(h.writes.length,0);
});
