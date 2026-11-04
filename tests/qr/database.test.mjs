import assert from 'node:assert/strict';
import { test,before,beforeEach,after } from 'node:test';
import { build } from 'esbuild';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { getTableConfig,MySqlDialect } from 'drizzle-orm/mysql-core';
import { SQL,eq } from 'drizzle-orm';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server.js';
import { SignJWT } from 'jose';

assert.equal(process.env.CI,'true');assert.equal(process.env.SKIPPER_STEP2_SQL_TEST_ONLY,'1');
process.env.JWT_SECRET='fixture-qr-session-not-deployment-secret';
const pool=mysql.createPool({host:'127.0.0.1',port:41306,user:'skipper_step2_test',password:'disposable-step2-only',database:'skipper_step2_ci',timezone:'Z',connectionLimit:8});
const db=drizzle(pool);globalThis.__qrDb=db;
const root=process.cwd(),dir=mkdtempSync(join(root,'.qr-sql-test-'));
const realNames=['engine-runtime-service','engine-runtime-core','engine-runtime-contract','qr-artifact','qr-artifact-contract','qr-artifact-renderer','approve-executive-action','reject-executive-action','approval-gated-execution','executive-action-executors','executive-action-payloads','executive-agent-policy','executive-agent-approvals-store','executive-agent-audit'];
const real=new Set(realNames.map(n=>'@/lib/executive-agent/'+n));
const sources=realNames.map(n=>readFileSync(resolve(root,'src/lib/executive-agent/'+n+'.ts'),'utf8')).join('\n');
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No target URL, model or provider fetch permitted');};
await build({stdin:{contents:`export {POST as gateway,GET as catalog} from './src/app/api/admin/executive-agent/engine-runtime/route.ts';export {GET as download} from './src/app/api/admin/executive-agent/qr/artifacts/[assetId]/[format]/route.ts';export {generateQrCode} from './src/lib/executive-agent/qr-artifact.ts';export * as artifacts from './src/lib/executive-agent/qr-artifact-renderer.ts';export * as schema from '@/lib/db/schema';`,resolveDir:root,loader:'ts'},outfile:join(dir,'qr.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'real-qr-and-real-approval-sql',setup(b){
  b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'fixture'}));
  b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
  b.onResolve({filter:/^@\//},a=>{
    if(a.path==='@/lib/db')return {path:'getDb',namespace:'fixture'};
    if(a.path==='@/lib/admin/get-executive-admin-user-id')return {path:'admin',namespace:'fixture'};
    if(real.has(a.path)||a.path.startsWith('@/app/api/admin/executive-agent/approvals/')||a.path.startsWith('@/lib/db/schema')||a.path==='@/lib/security/engine-route-access'||a.path==='@/lib/admin/admin-session-jwt')return {path:resolve(root,'src',a.path.slice(2)+'.ts')};
    return {path:a.path,namespace:'fixture'};
  });
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>{
    if(a.path==='server-only')return {contents:''};
    if(a.path==='getDb')return {contents:'export const getDb=async()=>globalThis.__qrDb;'};
    if(a.path==='admin')return {contents:`import {engineRouteActor} from '@/lib/security/engine-route-access';export const getExecutiveAdminUserId=async(req)=>{try{const a=await engineRouteActor(req);return a.admin?a.userId:null;}catch{return null;}};`,resolveDir:root};
    const names=new Set();
    for(const match of sources.matchAll(/(?:import|export)\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g))if(match[2]===a.path)for(const raw of match[1].split(',')){const n=raw.trim().split(/\s+/)[0];if(n&&n!=='type')names.add(n);}
    if(a.path==='@/lib/executive-agent/executive-agent-tools')for(const n of ['getPendingAccounts','getApprovedAccounts','getPlatformAnalyticsSummary','getBentleyCampaignOutputs','getExecutiveFulfillmentOperationsOverview','getExecutiveSmartTrustFulfillment','getInboxEngagementSummary','getKnowledgeBaseSummary'])names.add(n);
    return {contents:[...names].map(n=>`export const ${n}=()=>{throw Error('Unrelated executor or provider must not run');};`).join('\n'),loader:'ts'};
  });
}}]});
const m=await import(pathToFileURL(join(dir,'qr.mjs')));
const tables=['clients','trusts','trustAssets','executiveAgentMemoryItems','clientNotes','executiveAgentApprovals','executiveAgentAuditLogs'].map(n=>m.schema[n]);
const dialect=new MySqlDialect(),quote=n=>'`'+n.replaceAll('`','``')+'`';
const ddl=c=>[quote(c.name),c.getSQLType(),c.notNull?'NOT NULL':'',c.default===undefined?'':'DEFAULT '+(c.default instanceof SQL?dialect.sqlToQuery(c.default).sql:pool.escape(c.default)),c.autoIncrement?'AUTO_INCREMENT':'',c.primary?'PRIMARY KEY':'',c.hasOnUpdateNow?'ON UPDATE CURRENT_TIMESTAMP':''].filter(Boolean).join(' ');
const clientId='11111111-1111-4111-8111-111111111111',workspaceId='22222222-2222-4222-8222-222222222222';
const input={clientId,workspaceId,url:'https://example.invalid/client?x=1&view=welcome',ecc:'H'};
before(async()=>{const [[r]]=await pool.query('SELECT DATABASE() AS db');assert.equal(r.db,'skipper_step2_ci');const [rows]=await pool.query('SHOW TABLES');assert.equal(rows.length,0,'Fresh disposable DB required');});
beforeEach(async()=>{
  for(const table of tables){const cfg=getTableConfig(table);await pool.query('DROP TABLE IF EXISTS '+quote(cfg.name));await pool.query('CREATE TABLE '+quote(cfg.name)+' ('+cfg.columns.map(ddl).join(',')+') ENGINE=InnoDB');}
  await db.insert(m.schema.clients).values({id:clientId,userId:7,firstName:'Fixture',lastName:'Client',email:'fixture@example.invalid',addressLine1:'Fixture Street',city:'Fixture',state:'DC',postalCode:'00000'});
  await db.insert(m.schema.trusts).values({id:workspaceId,userId:7,clientId,name:'Fixture workspace'});
});
after(async()=>{await pool.end();delete globalThis.__qrDb;globalThis.fetch=originalFetch;rmSync(dir,{recursive:true,force:true});});
async function token(userId=7,admin=true){return new SignJWT({userId,isAdmin:admin}).setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));}
async function gateway(body,{userId=7,admin=true,origin='https://example.invalid',anonymous=false}={}){
  return m.gateway(new NextRequest('https://example.invalid/api/admin/executive-agent/engine-runtime',{method:'POST',headers:{origin,...anonymous?{}:{cookie:'auth-token='+await token(userId,admin)}},body:JSON.stringify(body)}));
}
async function proposal(payload=input){const id=randomUUID(),r=await gateway({operation:'propose',requestId:id,engineId:'qr.generate',input:payload});assert.equal(r.status,200,await r.clone().text());return id;}
async function approve(id,extra={}){return gateway({operation:'approve',requestId:id,humanConfirmed:true,...extra});}
async function receipt(id){const r=await gateway({operation:'receipt',requestId:id});assert.equal(r.status,200);return (await r.json()).receipt;}
async function download(id,format='png',{userId=7,admin=true,anonymous=false}={}){
  return m.download(new NextRequest('https://example.invalid/qr',{headers:anonymous?{}:{cookie:'auth-token='+await token(userId,admin)}}),{params:Promise.resolve({assetId:id,format})});
}
const count=async name=>(await db.select().from(m.schema[name])).length;

test('propose-only then real canonical approval stores files, note and audit receipt; stored files decode',async()=>{
  const id=await proposal();assert.equal(await count('trustAssets'),0);assert.equal((await receipt(id)).status,'pending');
  const approved=await approve(id);assert.equal(approved.status,200,await approved.clone().text());
  const job=await receipt(id);assert.equal(job.status,'executed');assert.equal(job.receiptVerified,true);
  const out=job.result.data;assert.equal(out.decode.png,true);assert.equal(out.decode.svg,true);assert.equal(out.url,input.url);
  assert.equal(await count('trustAssets'),1);assert.equal(await count('clientNotes'),1);assert.equal(await count('executiveAgentMemoryItems'),1);
  for(const format of ['png','svg']){
    const r=await download(out.qrAssetId,format);assert.equal(r.status,200);
    const bytes=Buffer.from(await r.arrayBuffer());assert.equal(m.artifacts.qrHash(bytes),out[format].sha256);await m.artifacts.decodeQrFile(bytes,format,input.url);
    assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('content-disposition'),/attachment/);
  }
});
test('non-owning admin and invalid URL cannot propose or generate',async()=>{
  assert.equal((await gateway({operation:'propose',requestId:randomUUID(),engineId:'qr.generate',input},{userId:8})).status,404);
  assert.equal((await gateway({operation:'propose',requestId:randomUUID(),engineId:'qr.generate',input:{...input,url:'javascript:alert(1)'}})).status,400);
  assert.equal(await count('executiveAgentApprovals'),0);assert.equal(await count('trustAssets'),0);
});
test('workspace or client revocation before approve leaves gateway proposal pending and writes no artifact',async()=>{
  for(const table of ['trusts','clients']){
    const id=await proposal();await db.update(m.schema[table]).set({userId:8});
    assert.equal((await approve(id)).status,404);assert.equal((await receipt(id)).status,'pending');assert.equal(await count('trustAssets'),0);
    await db.update(m.schema[table]).set({userId:7});
  }
});
test('forged confirmation is refused and repeated/concurrent canonical decisions execute only once',async()=>{
  const id=await proposal();assert.equal((await approve(id,{humanConfirmed:'true'})).status,400);assert.equal((await receipt(id)).status,'pending');
  const responses=await Promise.all([approve(id),approve(id),approve(id),approve(id)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409,409,409]);assert.equal(await count('trustAssets'),1);
  assert.equal((await approve(id)).status,409);assert.equal(await count('trustAssets'),1);
});
test('stored URL is canonical; changed-input replay cannot replace approved payload',async()=>{
  const id=await proposal();const changed=await gateway({operation:'propose',requestId:id,engineId:'qr.generate',input:{...input,url:'https://other.invalid'}});
  assert.equal(changed.status,409);assert.equal((await approve(id)).status,200);assert.equal((await receipt(id)).result.data.url,input.url);
});
test('anonymous/member/foreign users cannot download; ownership revocation blocks saved files',async()=>{
  const id=await proposal();await approve(id);const out=(await receipt(id)).result.data;
  assert.equal((await download(out.qrAssetId,'png',{anonymous:true})).status,401);
  assert.equal((await download(out.qrAssetId,'png',{admin:false})).status,403);
  assert.equal((await download(out.qrAssetId,'png',{userId:8})).status,404);
  await db.update(m.schema.trusts).set({userId:8});assert.equal((await download(out.qrAssetId)).status,404);
});
test('unknown file format and corrupt persisted bytes are refused',async()=>{
  const id=await proposal();await approve(id);const out=(await receipt(id)).result.data;
  assert.equal((await download(out.qrAssetId,'html')).status,404);
  const [memory]=await db.select().from(m.schema.executiveAgentMemoryItems);const record=JSON.parse(memory.summary);record.packed='broken';
  await db.update(m.schema.executiveAgentMemoryItems).set({summary:JSON.stringify(record)});assert.equal((await download(out.qrAssetId)).status,503);
});
test('savepoint rolls back linked files/config/note on persistence failure even if dispatcher catches',async()=>{
  const id=await proposal();await pool.query('ALTER TABLE executive_agent_memory_items MODIFY title VARCHAR(1) NOT NULL');
  await approve(id);assert.equal((await receipt(id)).status,'failed');
  assert.equal(await count('trustAssets'),0);assert.equal(await count('executiveAgentMemoryItems'),0);assert.equal(await count('clientNotes'),0);
});
test('executor rechecks current ownership even outside gateway and never renders for foreign workspace',async()=>{
  await assert.rejects(()=>m.generateQrCode({db,adminUserId:8,approvalId:randomUUID()},input),/owned/);
  await db.update(m.schema.trusts).set({clientId:randomUUID()});
  await assert.rejects(()=>m.generateQrCode({db,adminUserId:7,approvalId:randomUUID()},input),/owned/);assert.equal(await count('trustAssets'),0);
});
test('same-origin and administrator checks remain mandatory on gateway',async()=>{
  const body={operation:'propose',requestId:randomUUID(),engineId:'qr.generate',input};
  assert.equal((await gateway(body,{anonymous:true})).status,401);assert.equal((await gateway(body,{admin:false})).status,401);
  assert.equal((await gateway(body,{origin:'https://evil.invalid'})).status,403);assert.equal(await count('executiveAgentApprovals'),0);
});
test('canonical rejection closes the proposal without generating files',async()=>{
  const id=await proposal();const r=await gateway({operation:'reject',requestId:id,humanConfirmed:true});
  assert.equal(r.status,200);assert.equal((await receipt(id)).status,'rejected');assert.equal(await count('trustAssets'),0);
  assert.equal((await approve(id)).status,409);
});
test('ownership changed after rendering is refused by the locked persistence check',async()=>{
  const proxy=new Proxy(db,{get(target,key){
    if(key==='transaction')return async fn=>{await db.update(m.schema.trusts).set({userId:8});return db.transaction(fn);};
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
  await assert.rejects(()=>m.generateQrCode({db:proxy,adminUserId:7,approvalId:randomUUID()},input),/ownership changed/);
  assert.equal(await count('trustAssets'),0);assert.equal(await count('executiveAgentMemoryItems'),0);
});
