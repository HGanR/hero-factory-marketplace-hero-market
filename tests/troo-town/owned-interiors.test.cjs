const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const deps=process.env.TOWN_TEST_DEPS||path.resolve(__dirname,'../../../stadium-test-deps/node_modules');
const esbuild=require(deps+'/esbuild'),root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(os.tmpdir()+'/owned-interiors-');
esbuild.buildSync({entryPoints:[root+'/src/lib/world-assets/interior.ts',root+'/src/lib/world-engine/chunk-utils.ts'],bundle:true,platform:'node',format:'cjs',outdir:out,tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}}});
const {validateInterior,validatePlacementInteriors,INTERIOR_SLOTS}=require(out+'/world-assets/interior.js');
const {chunksToPlacements,placementsToChunks}=require(out+'/world-engine/chunk-utils.js');
const desk={id:'desk-1',kind:'desk',slotId:'SLOT_furniture_F1_02',rotationY:0};
const art={id:'art-1',kind:'wall-art',slotId:'SLOT_frame_01',rotationY:0,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ5kAAAAASUVORK5CYII=',href:'https://example.com/gallery'};
test('furnishings and linked artwork survive world save/load without changing other building copies',()=>{
 const a={id:'a',assetId:'owned',position:[4,0,8],rotation:[0,1,0],scale:[2,2,2],interior:validateInterior([desk,art])};
 const b={...a,id:'b',interior:[]};const chunks=JSON.parse(JSON.stringify(placementsToChunks([a,b])));
 validatePlacementInteriors(chunks,new Set(['owned']));const loaded=chunksToPlacements(chunks);
 assert.deepEqual(loaded[0].interior,a.interior);assert.deepEqual(loaded[1].interior,[]);assert.deepEqual(loaded[0].rotation,a.rotation);
 assert.equal(INTERIOR_SLOTS.length,32);
});
test('malicious links, non-raster images, duplicates and incompatible furnishing slots are rejected',()=>{
 for(const bad of [{...art,href:'javascript:alert(1)'},{...art,href:'https://user:secret@example.com'},{...art,image:'data:image/svg+xml;base64,abcd'},{...desk,rotationY:NaN},{...desk,slotId:'SLOT_frame_01'},{...desk,slotId:'SLOT_furniture_F1_01'}])assert.throws(()=>validateInterior([bad]));
 assert.throws(()=>validateInterior([desk,{...desk,id:'other'}]));assert.throws(()=>validateInterior([art,{...art,id:'other',slotId:'SLOT_frame_02',image:'x'.repeat(140001)}]));
});
test('interior payload cannot be smuggled into an unsupported catalog asset',()=>{
 assert.throws(()=>validatePlacementInteriors([{placementsJson:[{assetId:'unowned',interior:[desk]}]}],new Set(['owned'])));
 assert.throws(()=>validatePlacementInteriors([{placementsJson:{}}],new Set()));
});
test('the uploaded model exposes matching attachment points and retains its original binary',()=>{
 const model=fs.readFileSync(root+'/public/models/world-assets/storefront-v2/storefront_v2.glb');assert.equal(model.toString('utf8',0,4),'glTF');
 const json=JSON.parse(model.toString('utf8',20,20+model.readUInt32LE(12)));const names=new Set(json.nodes.map(n=>n.name));
 for(const slot of INTERIOR_SLOTS)assert.ok(names.has(slot.id),slot.id);assert.equal(json.meshes.length,38);
});
