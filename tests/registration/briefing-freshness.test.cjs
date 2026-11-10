const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
function fixture(admin=1){const state={pending:1,rebuilds:0};const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../src/app/api/admin/executive-agent/briefing/today/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date,console,require:id=>{
 if(id==='next/server')return {NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),options)}};
 if(id==='@/lib/admin/get-executive-admin-user-id')return {getExecutiveAdminUserId:async()=>admin};
 if(id==='@/lib/db')return {getDb:async()=>({})};
 if(id==='@/lib/executive-agent/executive-briefing-builder')return {briefingDateUtc:()=> '2026-11-10',buildExecutiveDailyBriefing:async()=>{state.rebuilds++;return {pending:state.pending};}};
 if(id==='@/lib/executive-agent/executive-briefing-redact')return {redactExecutiveBriefingJsonValue:value=>value};
 if(id==='@/lib/executive-agent/executive-memory-store')return {getExecutiveBriefingForAdminDate:async()=>({id:'stored',summaryJson:JSON.stringify({pending:0}),createdAt:'previous'})};
 throw Error(id);
}});return {state,get:date=>module.exports.GET({nextUrl:new URL('https://example.test/briefing'+(date?'?date='+date:''))})};}
test('today briefing rereads newly pending accounts instead of serving an earlier cached count',async()=>{const f=fixture();let response=await f.get();assert.equal((await response.json()).briefing.pending,1);f.state.pending=2;response=await f.get();assert.equal((await response.json()).briefing.pending,2);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(f.state.rebuilds,2);});
test('historical briefing stays as its original stored snapshot',async()=>{const f=fixture();assert.equal((await(await f.get('2026-11-09')).json()).briefing.pending,0);assert.equal(f.state.rebuilds,0);});
test('unauthenticated callers cannot retrieve the live account briefing',async()=>{const f=fixture(null);assert.equal((await f.get()).status,401);assert.equal(f.state.rebuilds,0);});
