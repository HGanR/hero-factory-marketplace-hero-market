// Run the actual route with deterministic media, auth and DB boundaries.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),esbuild=require('esbuild');
const {join}=require('node:path');
const src=fs.readFileSync(join(__dirname,'../../src/app/api/livekit/token/route.ts'),'utf8');
function harness(host,admitted=true,room){
 const grants=[],created=[],node={id:'abc',roomId:'default:abc',capacity:12};
 const mods={
 'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},
 '@/lib/stadium/server':{physical:id=>'stadium-event-'+id,stadiumNode:async id=>id==='abc'?node:undefined,stadiumAccess:async()=>({user:8,host,status:admitted?200:403})},
 'livekit-server-sdk':{
 RoomServiceClient:class{async listRooms(){return room?[room]:[]}async createRoom(r){created.push(r);return r}},
 AccessToken:class{constructor(k,s,opt){this.opt=opt}addGrant(g){grants.push([g,this.opt])}async toJwt(){return 'test-jwt'}}}
 };
 const scope={module:{exports:{}},require:k=>mods[k],process:{env:{LIVEKIT_URL:'wss://example.invalid',LIVEKIT_API_KEY:'test',LIVEKIT_API_SECRET:'test'}},console};
 vm.runInNewContext(esbuild.transformSync(src,{loader:'ts',format:'cjs',target:'es2022'}).code,scope);
 return {grants,created,request:name=>scope.module.exports.POST({json:async()=>({roomName:name,identity:'spoof',metadata:'host'})})};
}
test('no token for a direct internal room name, forged world, or unauthorized user',async()=>{
 const h=harness(false,false);for(const name of ['stadium-event-abc','other:abc','default:abc']) assert.equal((await h.request(name)).status,403);
 assert.equal(h.grants.length,0);assert.equal(h.created.length,0);
});
test('host opens bounded media room; server assigns identity and publishing',async()=>{
 const h=harness(true);assert.equal((await h.request('DEFAULT:ABC')).status,200);assert.equal(h.created[0].maxParticipants,12);
 const [[g,opt]]=h.grants;assert.equal(g.room,'stadium-event-abc');assert.equal(opt.identity,'account-8');assert.equal(g.canPublish,true);
});
test('audience cannot open a room or join a misconfigured unlimited room',async()=>{
 for(const room of [undefined,{maxParticipants:0}]){const h=harness(false,true,room);assert.equal((await h.request('default:abc')).status,409);assert.equal(h.created.length+h.grants.length,0)}
});
test('admitted audience receives subscribe-only media access; ordinary room unchanged',async()=>{
 const h=harness(false,true,{maxParticipants:12});assert.equal((await h.request('default:abc')).status,200);
 assert.equal(h.grants[0][0].canSubscribe,true);assert.equal(h.grants[0][0].canPublish,false);assert.equal(h.grants[0][0].canPublishData,false);
 assert.equal((await h.request('ordinary')).status,200);assert.equal(h.grants[1][0].canPublish,true);
});
