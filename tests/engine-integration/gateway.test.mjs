import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { getTableName } from 'drizzle-orm';
import { NextRequest } from 'next/server.js';

const root = process.cwd(), dir = mkdtempSync(join(root, '.engine-integration-'));
const dialect = new MySqlDialect();
const adapters = {
  '@/lib/admin/get-executive-admin-user-id': 'export const getExecutiveAdminUserId = async req => req.headers.get("x-test-admin") === "none" ? null : Number(req.headers.get("x-test-admin") || 7);',
  '@/lib/db': 'export const getDb = async () => globalThis.__engineFixture.db;',
  '@/lib/db/schema': `import { mysqlTable, varchar, int } from 'drizzle-orm/mysql-core';
    export const clients=mysqlTable('clients',{id:varchar('id',{length:36}),userId:int('userId')});
    export const web3Sites=mysqlTable('web3_sites',{id:varchar('id',{length:36}),userId:int('userId'),clientId:varchar('clientId',{length:36})});
    export const campaigns=mysqlTable('campaigns',{id:varchar('id',{length:36}),userId:varchar('userId',{length:36})});
    export const executiveAgentApprovals=mysqlTable('executive_agent_approvals',{id:varchar('id',{length:36}),adminUserId:int('adminUserId'),status:varchar('status',{length:20})});
    export const executiveAgentAuditLogs=mysqlTable('executive_agent_audit_logs',{outputJson:varchar('outputJson',{length:500}),adminUserId:int('adminUserId'),targetId:varchar('targetId',{length:36}),actionType:varchar('actionType',{length:64}),createdAt:varchar('createdAt',{length:30})});`,
  '@/lib/executive-agent/executive-agent-approvals-store': `
    export const getExecutiveApprovalById=async(db,id,owner)=>{const r=globalThis.__engineFixture.rows.get(id);return r?.adminUserId===owner?r:null;};
    export const getExecutiveApprovalForGate=async(db,id)=>globalThis.__engineFixture.rows.get(id)||null;
    export const insertExecutiveApproval=async(db,row)=>{const f=globalThis.__engineFixture;if(f.rows.has(row.id))throw Error('duplicate');f.rows.set(row.id,{...row,status:'pending'});};
    export const claimPendingExecutiveApproval=async(db,id,owner)=>{const row=globalThis.__engineFixture.rows.get(id);if(row?.adminUserId!==owner||row.status!=='pending')return false;row.status='approved';return true;};`,
  '@/lib/executive-agent/executive-agent-audit': 'export const insertExecutiveAgentAuditLog=async(db,row)=>{globalThis.__engineFixture.audits.push(row);};',
  '@/lib/executive-agent/executive-action-executors': `export const executeExecutiveApprovedAction=async(db,{adminUserId,approval})=>{
    const f=globalThis.__engineFixture,row=f.rows.get(approval.id);if(row?.adminUserId!==adminUserId||row.status!=='approved')throw Error('not approved');
    f.executions.push(structuredClone(row));if(f.loseResponse)throw Error('response lost');row.status='executed';
    return {ok:true,status:'executed',message:'Fixture executor'};};`,
  '@/lib/executive-agent/executive-agent-coordination-service': 'export const buildExecutiveAgentCoordinationOverviewForAdmin=async()=>({fixture:true});',
  '@/lib/executive-agent/executive-agent-tools': ['getPendingAccounts','getApprovedAccounts','getPlatformAnalyticsSummary','getBentleyCampaignOutputs','getSiteBuilderProjectStatus','getExecutiveFulfillmentOperationsOverview','getExecutiveSmartTrustFulfillment','getInboxEngagementSummary','getKnowledgeBaseSummary'].map(name=>`export const ${name}=async()=>({source:'${name}',fixture:true});`).join('\n'),
  '@/lib/executive-agent/executive-department-inbox-store': `export const listDepartmentMessagesForExecutiveAdmin=async(db,limit)=>{globalThis.__engineFixture.inboxLimits.push(limit);return [{id:'message-fixture',bodyText:'fixture text'}];};
    export const listApprovedMarketplaceUsers=async(db,limit)=>{globalThis.__engineFixture.inboxLimits.push(limit);return [{id:101,username:'fixture-recipient'}];};`,
};
await build({
  entryPoints: [resolve(root, 'src/app/api/admin/executive-agent/engine-runtime/route.ts')],
  outfile: join(dir,'gateway.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',
  plugins:[{name:'actual-gateway-and-gated-routes',setup(b){
    b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'fixture'}));
    b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
    b.onResolve({filter:/^@\//},args=>adapters[args.path] ? {path:args.path,namespace:'fixture'} : {path:resolve(root,'src',args.path.slice(2)+'.ts')});
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:adapters[args.path]||'',loader:'ts',resolveDir:root}));
  }}],
});
const {GET, POST}=await import(pathToFileURL(join(dir,'gateway.mjs')));
after(()=>{rmSync(dir,{recursive:true,force:true});delete globalThis.__engineFixture;});
const clientId='11111111-1111-4111-8111-111111111111';
function setup(){
  const f={rows:new Map(),audits:[],executions:[],inboxLimits:[],loseResponse:false,owned:true};
  function select(){let table;return {from(t){table=getTableName(t);return this;},where(){return this;},limit:async()=> f.owned&&['clients','campaigns','web3_sites'].includes(table)?[{id:clientId,clientId,name:'Fixture Draft',status:'DRAFT'}]:[],orderBy(){return this;},then(resolve){return Promise.resolve([]).then(resolve);}};}
  f.db={select,transaction:async fn=>fn(f.db),update:()=>({set:values=>({where:async expression=>{
    const params=dialect.sqlToQuery(expression).params;const [id,owner,status]=params;const row=f.rows.get(id);
    if(!row||row.adminUserId!==owner||row.status!==status)return [{affectedRows:0}];
    Object.assign(row,values);return [{affectedRows:1}];
  }})})};
  globalThis.__engineFixture=f;return f;
}
function request(body,owner=7,origin='https://example.invalid'){
 return new NextRequest('https://example.invalid/api/admin/executive-agent/engine-runtime', {method:'POST',headers:{origin,'x-test-admin':String(owner),'content-type':'application/json'},body:JSON.stringify(body)});
}
async function propose(engineId='bentley.market_research',input={clientId,industry:'barbershops'}){
 const id=randomUUID();const response=await POST(request({operation:'propose',requestId:id,engineId,input}));
 assert.equal(response.status,200);return id;
}
const decide=(id,operation='approve',extra={})=>POST(request({operation,requestId:id,humanConfirmed:true,...extra}));

test('catalog retains existing adapters plus the real Stephon draft adapter',async()=>{
 setup();const r=await GET(new NextRequest('https://example.invalid/api/admin/executive-agent/engine-runtime'));
 const data=await r.json();assert.equal(data.schema,'skipper-engine-runtime-v1');assert.equal(data.engines.length,14);
 assert.equal(data.engines.filter(e=>e.mode==='approval').length,4);assert.equal(data.engines.find(e=>e.id==='executive.inbox').mode,'read');
 assert.match(r.headers.get('cache-control'),/no-store/);
});
test('authentication and same-origin checks prevent gateway access',async()=>{
 const f=setup();assert.equal((await POST(request({},'none'))).status,401);
 assert.equal((await GET(new NextRequest('https://example.invalid',{headers:{'x-test-admin':'none'}}))).status,401);
 assert.equal((await POST(request({},7,'https://foreign.invalid'))).status,403);assert.equal(f.rows.size,0);
});
test('inbox read uses existing bounded reads and never proposes or executes',async()=>{
 const f=setup();const r=await POST(request({operation:'read',engineId:'executive.inbox',input:{}}));
 const data=await r.json();assert.equal(data.receipt.result.messages[0].id,'message-fixture');
 assert.deepEqual(f.inboxLimits.sort((a,b)=>a-b),[120,2500]);assert.equal(f.rows.size,0);assert.equal(f.executions.length,0);
});
test('proposal idempotence plus canonical approve handler executes one persisted action',async()=>{
 const f=setup(),id=await propose();assert.equal(f.executions.length,0);
 const results=await Promise.all(Array.from({length:4},()=>decide(id)));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(f.executions.length,1);
 assert.equal(f.executions[0].proposedAction,'triggerBentleyAnalysis');
 assert.equal(JSON.parse(f.executions[0].payloadJson).mode,'market_sweep');
 assert.equal(f.rows.get(id).status,'executed');assert.ok(f.audits.some(row=>row.actionType==='approval_refused'));
});
test('literal confirmation and stored action cannot be forged',async()=>{
 const f=setup(),id=await propose();
 for(const humanConfirmed of [false,'true',1,null])assert.equal((await decide(id,'approve',{humanConfirmed})).status,400);
 assert.equal((await decide(id,'approve',{payload:{publish:true}})).status,400);
 f.rows.get(id).proposedAction='createSpecializedAgent';assert.equal((await decide(id)).status,409);
 assert.equal(f.executions.length,0);assert.equal(f.rows.get(id).status,'pending');
});
test('a non-owning admin cannot decide or read an engine receipt',async()=>{
 const f=setup(),id=await propose();
 assert.equal((await POST(request({operation:'approve',requestId:id,humanConfirmed:true},8))).status,404);
 assert.equal((await POST(request({operation:'receipt',requestId:id},8))).status,404);
 assert.equal(f.rows.get(id).status,'pending');assert.equal(f.executions.length,0);
});
test('canonical reject handler updates shared queue and audits once; approve cannot revive it',async()=>{
 const f=setup(),id=await propose();assert.equal((await decide(id,'reject')).status,200);
 assert.equal(f.rows.get(id).status,'rejected');assert.ok(f.audits.some(row=>row.actionType==='approval_rejected'));
 assert.equal((await decide(id)).status,409);assert.equal(f.executions.length,0);
});
test('revoked client ownership prevents launching an existing proposal',async()=>{
 const f=setup(),id=await propose();f.owned=false;assert.equal((await decide(id)).status,404);
 assert.equal(f.rows.get(id).status,'pending');assert.equal(f.executions.length,0);
});
test('lost execution response retains claimed state and never auto-executes twice',async()=>{
 const f=setup(),id=await propose();f.loseResponse=true;assert.equal((await decide(id)).status,500);
 assert.equal(f.rows.get(id).status,'approved');assert.equal((await decide(id)).status,409);
 assert.equal(f.executions.length,1);
});
test('read-only adapters reject proposals and intake continues to mean a brief',async()=>{
 const f=setup();assert.equal((await POST(request({operation:'propose',requestId:randomUUID(),engineId:'executive.inbox',input:{}}))).status,400);
 const id=await propose('stephon.intake',{clientId,title:'Website',instruction:'Build it'});
 assert.equal(f.rows.get(id).proposedAction,'createSiteBuilderTask');assert.equal(f.executions.length,0);
});


test('new Stephon draft proposal preserves the reviewed generation mode and uses canonical approval',async()=>{
 const f=setup();const id=await propose('stephon.generate_draft',{clientId,siteId:clientId,input:{userPrompt:'Build a local business landing page'},generationMode:'deterministic'});
 assert.equal(f.executions.length,0);const row=f.rows.get(id);assert.equal(row.proposedAction,'generateStephonDraft');
 const stored=JSON.parse(row.payloadJson);assert.equal(stored.generationMode,'deterministic');assert.equal(stored.siteId,clientId);
 assert.equal((await decide(id,'approve',{humanConfirmed:false})).status,400);assert.equal(f.executions.length,0);
 assert.equal((await decide(id)).status,200);assert.equal(f.executions.length,1);assert.equal(f.executions[0].payloadJson,row.payloadJson);
});
test('catalog and project read expose bounded owned site context instead of an empty clientless tool call',async()=>{
 setup();const catalog=await (await GET(new NextRequest('https://example.invalid/api/admin/executive-agent/engine-runtime'))).json();
 assert.equal(catalog.businessContext.sites[0].name,'Fixture Draft');assert.equal(catalog.businessContext.siteLimit,50);
 const result=await (await POST(request({operation:'read',engineId:'stephon.projects',input:{}}))).json();
 assert.equal(result.receipt.result.sites[0].name,'Fixture Draft');assert.equal(result.receipt.result.limit,50);
});
