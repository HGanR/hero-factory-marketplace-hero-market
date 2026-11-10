const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function fixture(){
 let state={world:{id:'world-1',name:'My world',visibility:'private',status:'draft',ownerId:1},versions:[{id:'draft',type:'draft'}],chunks:[{version:'draft',chunkKey:'0_0',placementsJson:[{id:'p1',assetId:'asset',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1]}]}]};let backup;const env={user:1,failInsert:false,closed:0};
 const asset={id:'asset',assetId:'asset',name:'Building',licenseScope:'all_worlds_owned'};
 const db={async execute(sql,values=[]){
  if(sql.startsWith('SELECT id, name'))return [[values[0]===state.world.id&&values[1]===state.world.ownerId?state.world:null].filter(Boolean)];
  if(sql.startsWith('SELECT id FROM world_versions'))return [state.versions.filter(v=>v.type===values[1]).map(v=>({id:v.id}))];
  if(sql.startsWith('SELECT chunkKey'))return [state.chunks.filter(c=>c.version===values[0]).map(({chunkKey,placementsJson})=>({chunkKey,placementsJson}))];
  if(sql.startsWith('SELECT a.id')||sql.startsWith('SELECT assetId'))return [[asset]];
  if(sql.startsWith('DELETE FROM world_chunk')){state.chunks=state.chunks.filter(c=>c.version!==values[0]);return [{}];}
  if(sql.startsWith('INSERT INTO world_chunk')){if(env.failInsert)throw Error('Injected failure');state.chunks.push({version:values[1],chunkKey:values[2],placementsJson:JSON.parse(values[3])});return [{}];}
  if(sql.startsWith('INSERT INTO world_versions')){state.versions.push({id:values[0],type:values[2]});return [{}];}
  if(sql.startsWith('UPDATE worlds SET visibility'))state.world.visibility=values[0];
  if(sql.startsWith('UPDATE worlds SET status'))state.world.status=values[0];
  return [{}];
 },async beginTransaction(){backup=structuredClone(state);},async commit(){backup=null;},async rollback(){state=backup;},async end(){env.closed++;}};
 const cache={};function load(file){if(cache[file])return cache[file];const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,process:{env:{DATABASE_URL:'test'}},Response,Buffer,TextDecoder,console,require:id=>{
  if(id==='next/server')return {NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),options)}};
  if(id==='mysql2/promise')return {__esModule:true,default:{createConnection:async()=>db}};
  if(id==='@/lib/db')return {getConnection:async()=>db};
  if(id==='@/app/api/mobile/session/route')return {GET:async()=>new Response(JSON.stringify(env.user?{user:{id:env.user}}:{error:'Sign in'}),{status:env.user?200:401})};
  if(id==='@/lib/mobile/session-policy')return {mobileSameOrigin:r=>r.headers.get('origin')==='https://mobile.example'};
  if(id.startsWith('@/'))return load('src/'+id.slice(2)+'.ts');return require(id);
 }});cache[file]=module.exports;return module.exports;}
 const route=()=>load('src/app/api/mobile/worlds/[worldId]/route.ts');const context={params:Promise.resolve({worldId:'world-1'})};
 const get=async()=>route().GET({},context);
 const post=async body=>route().POST(new Request('https://mobile.example/api/mobile/worlds/world-1',{method:'POST',headers:{origin:'https://mobile.example','content-type':'application/json'},body:JSON.stringify(body)}),context);
 return {env,db,load,get,post};
}
test('mobile save/reload restores position, rotation, scale and stable world address',async()=>{const f=fixture();const original=await(await f.get()).json();original.placements[0].position=[70,8,-20];original.placements[0].rotation=[0,1,0];original.placements[0].scale=[2,2,2];const save=await f.post({action:'save',revision:original.revision,placements:original.placements});assert.equal(save.status,200);const restored=await(await f.get()).json();assert.deepEqual(restored.placements,original.placements.map(p=>({...p,ownerLayer:'user'})));assert.equal(restored.world.shareUrl,original.world.shareUrl);assert.equal(f.env.closed,1);});
test('failed write rolls back the old saved placements',async()=>{const f=fixture();const original=await(await f.get()).json();f.env.failInsert=true;assert.equal((await f.post({action:'save',revision:original.revision,placements:original.placements})).status,503);const restored=await(await f.get()).json();assert.deepEqual(restored.placements,original.placements);});
test('stale revisions cannot overwrite another session',async()=>{const f=fixture();const original=await(await f.get()).json();assert.equal((await f.post({action:'save',revision:original.revision,placements:[]})).status,200);assert.equal((await f.post({action:'save',revision:original.revision,placements:original.placements})).status,409);});
test('signed-out and different-member requests are rejected',async()=>{const f=fixture();f.env.user=null;assert.equal((await f.get()).status,401);f.env.user=2;assert.equal((await f.get()).status,404);});
test('unowned assets cannot be saved',async()=>{const f=fixture();const original=await(await f.get()).json();original.placements[0].assetId='unowned';assert.equal((await f.post({action:'save',revision:original.revision,placements:original.placements})).status,403);});
test('invalid numeric values and duplicate placement IDs are rejected',()=>{const f=fixture();const validate=f.load('src/lib/mobile/worlds.ts').validatePlacements;const p={id:'a',assetId:'asset',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};assert.throws(()=>validate([p,p]));assert.throws(()=>validate([{...p,position:[null,0,0]}]));assert.throws(()=>validate([{...p,scale:[0,1,1]}]));});
test('publishing keeps the stable address and private visibility until explicitly changed',async()=>{const f=fixture();const original=await(await f.get()).json();let data=await(await f.post({action:'publish',revision:original.revision})).json();assert.equal(data.world.status,'published');assert.equal(data.world.visibility,'private');data=await(await f.post({action:'visibility',revision:data.revision,visibility:'unlisted'})).json();assert.equal(data.world.visibility,'unlisted');assert.equal(data.world.shareUrl,original.world.shareUrl);});
test('distinct world IDs always yield distinct encoded addresses',()=>{const f=fixture();const address=f.load('src/lib/mobile/worlds.ts').worldAddress;assert.notEqual(address('one'),address('two'));assert.equal(address('a/b'),'https://troothhurtz.app/worlds/a%2Fb');});
