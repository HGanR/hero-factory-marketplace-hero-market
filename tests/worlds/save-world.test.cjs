const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const names = ['worlds','worldVersions','worldChunkPlacements','userWorldAssets'];
const schema = Object.fromEntries(names.map(name => [name, new Proxy({ name }, { get: (t,k) => k === 'name' ? t.name : k })]));
const eq = (key,value) => row => row[key] === value;
const sql = (parts,...values) => ({ text: parts.join('?'), values });
function environment() {
  let state = { worlds: [{ id:'world-1', ownerId:1, ownerWallet:null, visibility:'unlisted', status:'draft', name:'My World' }],
    worldVersions:[{ id:'draft-1',worldId:'world-1',versionType:'draft',versionNumber:1 }],
    worldChunkPlacements:[{id:'old',worldVersionId:'draft-1',chunkKey:'0,0',placementsJson:[{id:'old',assetId:'asset-1',position:[1,2,3]}]}],
    userWorldAssets:[{ userId:1,assetId:'asset-1' }] };
  const env = { userId:1, failInsert:false, failRead:false, closed:0, locks:0, events:[] };
  function database(get,set) {
    return {
      select(fields) { let rows=[];const q={from(t){rows=get()[t.name];return q;},where(filter){rows=rows.filter(filter);return q;},
        limit(n){return Promise.resolve(rows.slice(0,n).map(project));}, then(resolve,reject){return Promise.resolve(rows.map(project)).then(resolve,reject);}};
        function project(row){return fields ? Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,row[v]])) : structuredClone(row);}return q; },
      insert(t){return {values: async value=>{if(env.failInsert && t.name==='worldChunkPlacements')throw Error('injected storage failure');get()[t.name].push(structuredClone(value));}};},
      delete(t){return {where:async predicate=>{get()[t.name]=get()[t.name].filter(row=>!predicate(row));}};},
      update(t){return {set:value=>({where:async predicate=>{for(const row of get()[t.name])if(predicate(row))Object.assign(row,value);}})};},
      async execute(query){
        if(query.text.includes('FOR UPDATE')){env.locks++;return [[]];}
        if(env.failRead)throw Error('injected read failure');
        if(query.text.includes('FROM world_versions'))return [get().worldVersions.filter(r=>r.worldId===query.values[0]&&r.versionType===query.values[1])];
        if(query.text.includes('FROM world_chunk_placements'))return [get().worldChunkPlacements.filter(r=>r.worldVersionId===query.values[0])];
        if(query.text.includes('FROM world_reserved_zones'))return [[]];
        if(query.text.includes('INSERT INTO worlds')) {const [id,ownerId,name,description,visibility,terrainSeed,biomeType,status]=query.values;get().worlds.push({id,ownerId,name,description,visibility,terrainSeed,biomeType,status});return [{}];}
        if(query.text.includes('FROM worlds'))return [get().worlds.filter(r=>r.id===query.values[0])];
        throw Error('Unhandled query '+query.text);
      },
      async transaction(callback){const snapshot=structuredClone(get());const tx=database(()=>snapshot,()=>{});const result=await callback(tx);set(snapshot);return result;},
    };
  }
  const db=database(()=>state,next=>{state=next;});
  const cache={};
  function load(file){if(cache[file])return cache[file];const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:request=>{
      if(request==='next/server')return {NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),{...options,headers:{'Content-Type':'application/json',...options.headers}})}};
      if(request==='drizzle-orm')return {eq,and:(...checks)=>row=>checks.every(check=>check(row)),inArray:(key,values)=>row=>values.includes(row[key]),sql};
      if(request==='drizzle-orm/mysql2')return {drizzle:()=>db};
      if(request==='mysql2/promise')return {__esModule:true,default:{createConnection:async()=>({end:async()=>{env.closed++;}})}};
      if(request==='@/lib/db')return {getDb:async()=>db};
      if(request==='@/lib/db/schema.worlds')return schema;
      if(request==='@/lib/api/auth')return {getAuthedUserId:async()=>env.userId};
      if(request==='@/lib/auth')return {verifyToken:()=>null};
      if(request==='@/lib/api/worlds-helpers')return {getWorldById:async(_,id)=>state.worlds.find(w=>w.id===id)};
      if(request==='@/lib/world-write')return load('src/lib/world-write.ts');
      if(request==='@/lib/workflow-engine/emit-platform-event')return {emitPlatformEvent:async(name)=>env.events.push({name,chunks:structuredClone(state.worldChunkPlacements)})};
      return require(request);
    },process:{env:{DATABASE_URL:'test-only'}},Response,structuredClone,console:process.env.WORLD_TEST_DEBUG ? console : {error(){}},Buffer},{filename:file});cache[file]=module.exports;return module.exports;
  }
  const request=body=>({headers:new Headers(),cookies:{get:()=>undefined},json:async()=>body});
  const params={params:Promise.resolve({worldId:'world-1'})};
  return Object.assign(env,{load,request,params,get state(){return state;}});
}
const placements=[{id:'building',assetId:'asset-1',position:[21,0,-8],rotation:[0,1.5,0],scale:[2,2,2]}];
const payload={chunks:[{chunkKey:'0,0',placementsJson:placements}]};
test('save → reload restores asset, position, rotation and scale from account storage',async()=>{
 const e=environment();const response=await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request(payload),e.params);assert.equal(response.status,200);
 const loaded=await e.load('src/app/api/worlds/[worldId]/data/route.ts').GET({},e.params);const data=await loaded.json();assert.deepEqual(data.chunks[0].placementsJson,placements);assert.match(loaded.headers.get('Cache-Control'),/no-store/);assert.equal(e.closed,1);assert.equal(e.locks,1);assert.equal(e.events[0].chunks[0].placementsJson[0].id,'building');
});
test('failed replacement rolls back and retains the previous saved world',async()=>{
 const e=environment();e.failInsert=true;const response=await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request(payload),e.params);assert.equal(response.status,500);
 const loaded=await e.load('src/app/api/worlds/[worldId]/data/route.ts').GET({},e.params);assert.equal((await loaded.json()).chunks[0].placementsJson[0].id,'old');assert.equal(e.closed,1);assert.equal(e.events.length,0);
});
test('empty world is saved intentionally and stays empty on reload',async()=>{
 const e=environment();assert.equal((await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request({chunks:[]}),e.params)).status,200);
 const loaded=await e.load('src/app/api/worlds/[worldId]/data/route.ts').GET({},e.params);assert.deepEqual((await loaded.json()).chunks,[]);
});
test('missing chunks and invalid payload do not erase placements',async()=>{
 for(const body of [{}, {chunks:[{chunkKey:'a',placementsJson:null}]}, {chunks:[{chunkKey:'a',placementsJson:[]},{chunkKey:'a',placementsJson:[]}]}]){
 const e=environment();assert.equal((await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request(body),e.params)).status,400);assert.equal(e.events.length,0);assert.equal(e.closed,0);}
});
test('another member cannot overwrite the world',async()=>{
 const e=environment();e.userId=2;assert.equal((await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request(payload),e.params)).status,403);assert.equal(e.closed,0);
});
test('storage read failure reports failure rather than an empty successful world',async()=>{
 const e=environment();e.failRead=true;assert.equal((await e.load('src/app/api/worlds/[worldId]/data/route.ts').GET({},e.params)).status,500);
});
test('published visitor snapshot persists after publication; owner keeps editable draft',async()=>{
 const e=environment();await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request(payload),e.params);
 const published=await e.load('src/app/api/worlds/[worldId]/publish/route.ts').POST({ ...e.request({}),nextUrl:{origin:'https://example.test'} },e.params);
 assert.equal(published.status,200);assert.equal((await published.json()).shareUrl,'https://example.test/worlds/world-1');
 e.userId=null;const data=await (await e.load('src/app/api/worlds/[worldId]/data/route.ts').GET({},e.params)).json();assert.deepEqual(data.chunks[0].placementsJson,placements);assert.equal(data.version.versionType,'published');
});
test('failed publication preserves the previous published snapshot',async()=>{
 const e=environment();const publish=e.load('src/app/api/worlds/[worldId]/publish/route.ts');const req={...e.request({}),nextUrl:{origin:'https://example.test'}};
 assert.equal((await publish.POST(req,e.params)).status,200);await e.load('src/app/api/worlds/[worldId]/draft/route.ts').PUT(e.request(payload),e.params);e.failInsert=true;
 assert.equal((await publish.POST(req,e.params)).status,500);e.userId=null;const data=await (await e.load('src/app/api/worlds/[worldId]/data/route.ts').GET({},e.params)).json();assert.equal(data.chunks[0].placementsJson[0].id,'old');
});
test('two worlds with identical names receive different persistent world addresses',async()=>{
 const e=environment();const create=e.load('src/app/api/worlds/route.ts').POST;const first=await create(e.request({name:'Same name'}));const second=await create(e.request({name:'Same name'}));
 assert.equal(first.status,201);assert.equal(second.status,201);const a=(await first.json()).world.id,b=(await second.json()).world.id;assert.notEqual(a,b);assert.notEqual(`/worlds/${a}`,`/worlds/${b}`);
});
