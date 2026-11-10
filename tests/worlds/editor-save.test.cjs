const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.createSourceFile('editor.tsx',fs.readFileSync(path.resolve(__dirname,'../../src/app/worlds/[worldId]/edit/page.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function initializer(name) {
 let found;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)found=node.initializer.getText(source);ts.forEachChild(node,walk);}walk(source);assert.ok(found,`${name} exists`);return found;
}
function fixture(fetch) {
 const baseline={current:[{id:'old'}]}, flight={current:false}, messages=[];
 const context={useCallback:f=>f,worldId:'world-1',writeInFlight:flight,placements:[{id:'placed',assetId:'asset',position:[1,2,3]}],structuredClone,
 placementsToChunks:p=>[{chunkKey:'0,0',placementsJson:p}],fetch,authHeadersWithSign:async()=>({}),lastSavedPlacements:baseline,
 setSaveMessage:m=>messages.push(m),setSaving(){},setPublishing(){},setWorld(){}};
 const code=`const saveSnapshot = ${initializer('saveSnapshot')}; const handleSaveDraft = ${initializer('handleSaveDraft')}; const handlePublish = ${initializer('handlePublish')}; result = {saveSnapshot,handleSaveDraft,handlePublish};`;
 const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(compiled,context);return { ...context.result, baseline, flight, messages, context };
}
const ok=()=>({ok:true,json:async()=>({success:true})});
test('Publish saves current placements before requesting publication',async()=>{
 const calls=[];const f=fixture(async(url,options)=>{calls.push({url,options});return ok();});await f.handlePublish();assert.equal(calls.length,2);assert.match(calls[0].url,/\/draft$/);assert.equal(JSON.parse(calls[0].options.body).chunks[0].placementsJson[0].id,'placed');assert.match(calls[1].url,/\/publish$/);
});
test('failed save stops publication and leaves the previous saved baseline intact',async()=>{
 const calls=[];const f=fixture(async url=>{calls.push(url);return {ok:false,json:async()=>({error:'Storage unavailable'})};});await f.handlePublish();assert.equal(calls.length,1);assert.equal(f.baseline.current[0].id,'old');assert.equal(f.messages.at(-1),'Storage unavailable');assert.equal(f.flight.current,false);
});
test('edits made during save are not incorrectly marked as saved',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>{resolve=r;}));const saving=f.handleSaveDraft();await new Promise(setImmediate);f.context.placements[0].position[0]=99;resolve(ok());await saving;assert.equal(f.baseline.current[0].position[0],1);assert.equal(f.context.placements[0].position[0],99);
});
test('duplicate clicks cannot start overlapping save requests',async()=>{
 let resolve;let calls=0;const f=fixture(()=>{calls++;return new Promise(r=>{resolve=r;});});const first=f.handleSaveDraft();await new Promise(setImmediate);await f.handleSaveDraft();assert.equal(calls,1);resolve(ok());await first;
});
