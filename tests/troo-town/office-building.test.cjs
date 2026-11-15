const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const deps=process.env.TOWN_TEST_DEPS||path.resolve(__dirname,'../../../stadium-test-deps/node_modules'),esbuild=require(deps+'/esbuild');
const root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(os.tmpdir()+'/office-walk-');
esbuild.buildSync({entryPoints:[root+'/src/lib/troo-world/office-building.ts',root+'/src/lib/troo-world/green-terrain-layout.ts',root+'/src/lib/world-assets/interior.ts',root+'/src/lib/troo-world/stadium-navigation.ts',root+'/src/lib/troo-world/presence-model.ts'],outdir:out,bundle:true,format:'cjs',platform:'node',external:['three']});
const {officeEntry,officeWalker}=require(out+'/troo-world/office-building.js'),{fromInteriorLocal,toInteriorLocal}=require(out+'/troo-world/stadium-navigation.js');
const {validateLayout,DEFAULT_BUILDINGS}=require(out+'/troo-world/green-terrain-layout.js'),{validateInterior}=require(out+'/world-assets/interior.js');
const desk={id:'custom-1',slotId:'custom-1',kind:'desk',position:[2,3.2,-1],rotationY:.8};
test('administrator interiors attach independently to any building and imported office, without ownership records',()=>{
 const layout={version:1,buildings:structuredClone(DEFAULT_BUILDINGS),trees:[],objects:[],imports:[{elementKey:'office-a',glbUrl:'/models/world-assets/storefront-v2/storefront_v2.glb',position:[15,2,-8],scale:.5,rotationY:.9,interior:[desk]}],ambient:{enabled:false,sidewalks:false}};
 for(const b of Object.values(layout.buildings))b.interior=[desk];
 const saved=validateLayout(JSON.parse(JSON.stringify(layout)));assert.deepEqual(saved,layout);
 saved.buildings['nexus-tower'].interior[0].position[0]=7;assert.equal(saved.imports[0].interior[0].position[0],2);assert.equal(saved.buildings['meridian-tower'].interior[0].position[0],2);
 assert.throws(()=>validateInterior([desk]));assert.throws(()=>validateInterior([{...desk,position:[NaN,0,0]}],true));
});
test('real office entry, stair ramps and room boundaries follow nondefault size, rotation and location',async()=>{
 const {GLTFLoader}=await import(deps+'/three/examples/jsm/loaders/GLTFLoader.js'),THREE=await import(deps+'/three/build/three.module.js');
 const b=fs.readFileSync(root+'/public/models/world-assets/storefront-v2/storefront_v2.glb');const model=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 for(const scale of [.15,.5,1,2]){
  const frame={position:[17,3,-28],scale,rotationY:.73},group=new THREE.Group();group.add(model.scene.clone(true));group.position.fromArray(frame.position);group.scale.setScalar(scale);group.rotation.y=frame.rotationY;group.updateMatrixWorld(true);
  group.traverse(n=>{if(n.name.startsWith('COL_'))n.visible=false});const walking=officeWalker(frame,()=>group);let p=officeEntry(frame).position;
  const go=(x,z)=>{for(let i=0;i<260;i++){const local=toInteriorLocal(p,frame),dx=x-local[0],dz=z-local[2],d=Math.hypot(dx,dz);if(d<.01)break;const wanted=fromInteriorLocal([local[0]+dx/d*Math.min(.08,d),local[1],local[2]+dz/d*Math.min(.08,d)],frame);p=walking.move(p,wanted)};};
  go(5.5,3.6);go(5.5,-2.3);assert.ok(Math.abs(toInteriorLocal(p,frame)[1]-5.75)<.02,'second floor reached');
  go(0,-3);go(-5.5,-3);go(-5.5,3.7);go(-5.5,-2.3);assert.ok(Math.abs(toInteriorLocal(p,frame)[1]-9.35)<.02,'third floor reached');
  go(-5.5,3.7);go(-3,3.7);go(0,-3);go(5.5,-2.3);go(5.5,3.6);assert.ok(toInteriorLocal(p,frame)[1]<2.5,'stairs can be descended');
  go(100,100);const local=toInteriorLocal(p,frame);assert.ok(local[0]<=7.66&&local[2]<=6.56,'walls contain movement');
 }
});

test('office avatar poses remain valid and separate nearby conversations by placed office',()=>{
 const {validPose,proximityGain}=require(out+'/troo-world/presence-model.js');
 const pose={position:[18,.225,18],yaw:.3,mode:'standing',zone:'office:storefront-v2-test'};
 assert.equal(validPose(pose),true);assert.equal(proximityGain(pose,{...pose,zone:'office:another-copy'}),0);
 assert.equal(proximityGain(pose,{...pose,position:[19,.225,18]}),1);
 assert.equal(validPose({...pose,zone:'office:'+'x'.repeat(81)}),false);
});

test('Level 2 Store uses its real exterior switchback tower to reach the roof at resized and rotated placements',async()=>{
 const {GLTFLoader}=await import(deps+'/three/examples/jsm/loaders/GLTFLoader.js'),THREE=await import(deps+'/three/build/three.module.js');
 const b=fs.readFileSync(root+'/public/models/world-assets/storefront-v3/storefront_v3.glb');const model=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 for(const scale of [.3,1,2]){
  const frame={glbUrl:'/models/world-assets/storefront-v3/storefront_v3.glb',position:[17,3,-28],scale,rotationY:.73},group=new THREE.Group();group.add(model.scene.clone(true));group.position.fromArray(frame.position);group.scale.setScalar(scale);group.rotation.y=frame.rotationY;group.updateMatrixWorld(true);
  group.traverse(n=>{if(n.name.startsWith('COL_'))n.visible=false});const walking=officeWalker(frame,()=>group);let p=officeEntry(frame).position;
  const go=(x,z)=>{for(let i=0;i<600;i++){const local=toInteriorLocal(p,frame),dx=x-local[0],dz=z-local[2],d=Math.hypot(dx,dz);if(d<.01)break;const wanted=fromInteriorLocal([local[0]+dx/d*Math.min(.08,d),local[1],local[2]+dz/d*Math.min(.08,d)],frame);p=walking.move(p,wanted)}};
  go(4.5,5.6);go(-9.3,5.6);go(-9.3,1.6);
  for(let story=0;story<3;story++){go(-9.3,-2.4);go(-10.6,-2.4);go(-10.6,2.4);assert.ok(Math.abs(toInteriorLocal(p,frame)[1]-(5.75+story*3.6))<.08,'level '+(story+2)+' reached: '+JSON.stringify(toInteriorLocal(p,frame)));if(story<2)go(-9.3,2.4);}
  go(-10.6,-2.4);go(-9.3,-2.4);go(-9.3,2.4);assert.ok(toInteriorLocal(p,frame)[1]<10,'roof stairs descend');
 }
});
