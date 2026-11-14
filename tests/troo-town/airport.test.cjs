/** Real supplied GLB + Three mixer. DOM tests double only the R3F/Drei mounting boundary. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),deps=process.env.TOWN_TEST_DEPS;
const esbuild=require('esbuild'),out=fs.mkdtempSync(require('node:os').tmpdir()+'/airport-test-');
esbuild.buildSync({stdin:{contents:`export * from './src/lib/troo-world/airport';export * from './src/lib/troo-world/airport-playback';export * from './src/lib/troo-world/green-terrain-layout';export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';export {Box3} from 'three';`,resolveDir:root},outfile:out+'/model.cjs',bundle:true,platform:'node',nodePaths:deps?[deps]:[],format:'cjs'});
const lib=require(out+'/model.cjs');let gltf;
test.before(async()=>{const b=fs.readFileSync(root+'/public'+lib.AIRPORT.modelUrl);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);gltf=await new lib.GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')});
test('place once; preserve the complete town and round-trip airport transforms',()=>{
 const existing={elementKey:'existing',glbUrl:'/models/existing.glb',position:[12,3,4],scale:2,rotationY:.4};const imports=lib.placeAirport([existing]);assert.deepEqual(imports[0],existing);assert.equal(imports.length,2);assert.equal(lib.placeAirport(imports),imports);
 const airport={...imports[1],position:[8,2,-60],scale:.15,rotationY:Math.PI/2};
 const layout={version:1,buildings:structuredClone(lib.DEFAULT_BUILDINGS),trees:[],objects:[],imports:[existing,airport],ambient:{enabled:false,sidewalks:false}};
 assert.deepEqual(lib.validateLayout(JSON.parse(JSON.stringify(layout))),layout);
 const view=lib.airportView(airport);assert.ok(Math.abs(view.position[0]-71)<1e-9);assert.ok(Math.abs(view.position[2]+123)<1e-9);
 assert.throws(()=>lib.placeAirport(Array.from({length:100},(_,i)=>({...existing,elementKey:'model'+i}))));assert.throws(()=>lib.placeAirport([{...existing,elementKey:lib.AIRPORT.key}]));
});
test('source has the full cycle and static runway; each visitor owns independent animated nodes',()=>{
 const clip=gltf.animations.find(c=>c.name==='AirportCycle_30min');assert.equal(clip.duration,1800);assert.equal(clip.tracks.length,27);
 const staticBounds=new lib.Box3().setFromObject(gltf.scene.getObjectByName('Airport_Static'));assert.equal(staticBounds.min.x,-300);assert.equal(staticBounds.max.x,300);
 const a=lib.createAirportPlayback(gltf.scene,gltf.animations),b=lib.createAirportPlayback(gltf.scene,gltf.animations);a.activate();b.activate();const plane=a.object.getObjectByName('Airliner'),initial=plane.position.clone();
 a.seek(1450);assert.notDeepEqual(plane.position.toArray(),initial.toArray());assert.deepEqual(b.object.getObjectByName('Airliner').position.toArray(),initial.toArray());assert.deepEqual(gltf.scene.getObjectByName('Airliner').position.toArray(),initial.toArray());
 a.setPlaying(false);a.update(1);assert.equal(a.time,1450);a.setPlaying(true);a.setRate(30);a.update(1);assert.equal(a.time,1480);a.setRate(99);a.update(1);assert.equal(a.time,1510);a.seek(NaN);assert.equal(a.time,1510);a.seek(1799);a.update(1);assert.equal(a.time,29);
 a.seek(0);assert.ok(plane.position.distanceTo(initial)<1e-5);a.dispose();a.activate();a.update(1);assert.equal(a.time,30);a.dispose();b.dispose();
 assert.ok(lib.AIRPORT.stages.every(s=>s.time>=0&&s.time<clip.duration));assert.equal(lib.airportStage(1405).name,'Takeoff');
});
test('only static terminal/tower meshes collide; runway, passengers and airliner remain unblocked',()=>{
 const a=lib.createAirportPlayback(gltf.scene,gltf.animations);let solids=0;a.object.traverse(n=>{if(n.userData.townSolid){solids++;assert.ok(['terminal','roof','tower','glass_dark'].includes(n.material.name));}});assert.ok(solids>0);assert.equal(a.object.getObjectByName('Airliner').userData.townSolid,undefined);assert.equal(gltf.scene.getObjectByName('Airport_Static').userData.townSolid,undefined);a.dispose();
});

test('destination validation preserves old layouts, round-trips named links and rejects unsafe or oversized lists',()=>{
 const routes=[{id:'abc',name:'ABC',url:'https://member.example/world?visit=airport#arrival'},{id:'town',name:'Local Town',url:'/worlds/local'}];assert.deepEqual(lib.validateDestinations(routes),routes);
 const airport={...lib.placeAirport([])[0],destinations:routes};const world={version:1,buildings:structuredClone(lib.DEFAULT_BUILDINGS),trees:[],objects:[],imports:[airport],ambient:{enabled:false,sidewalks:false}};assert.deepEqual(lib.validateLayout(JSON.parse(JSON.stringify(world))),world);
 for(const url of ['javascript:alert(1)','data:text/html,hello','//evil.test','https://user:secret@member.example/world','http://member.example/world','/\\evil.test'])assert.throws(()=>lib.validateDestinations([{id:'a',name:'ABC',url}]));
 assert.throws(()=>lib.validateDestinations([...routes,routes[0]]));assert.throws(()=>lib.validateDestinations(Array.from({length:25},(_,i)=>({id:String(i),name:'Town',url:'https://member.example'}))));assert.throws(()=>lib.validateDestinations([{id:'a',name:'  ',url:'https://member.example'}]));
});

test('departures anchor is measured above terminal faces rather than the runway or animated aircraft',()=>{const anchor=lib.airportTerminalAnchor(gltf.scene);assert.ok(anchor.every(Number.isFinite));assert.ok(anchor[1]>14&&anchor[1]<80);const before=[...anchor],playback=lib.createAirportPlayback(gltf.scene,gltf.animations);playback.activate();playback.seek(1450);assert.deepEqual(lib.airportTerminalAnchor(gltf.scene),before);playback.dispose()});
