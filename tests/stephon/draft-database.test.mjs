import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { build } from 'esbuild';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { getTableConfig, MySqlDialect } from 'drizzle-orm/mysql-core';
import { SQL, eq } from 'drizzle-orm';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { NextRequest } from 'next/server.js';
import { SignJWT } from 'jose';

assert.equal(process.env.CI,'true');assert.equal(process.env.SKIPPER_STEP2_SQL_TEST_ONLY,'1');
process.env.JWT_SECRET='fixture-stephon-session-not-deployment-secret';
const pool=mysql.createPool({host:'127.0.0.1',port:41306,user:'skipper_step2_test',password:'disposable-step2-only',database:'skipper_step2_ci',timezone:'Z',connectionLimit:5});
const db=drizzle(pool);globalThis.__stephonDb=db;
const root=process.cwd(),dir=mkdtempSync(join(root,'.stephon-test-'));
const fetchBefore=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('No network/provider/publication permitted in this test');};
await build({stdin:{contents:`export {generateStephonDraft} from './src/lib/executive-agent/stephon-draft.ts';export {GET} from './src/app/api/admin/executive-agent/stephon/preview/[versionId]/[...file]/route.ts';export * as schema from '@/lib/db/schema';export * as artifacts from './src/lib/site-builder/stephon-private-artifact.ts';`,resolveDir:root,loader:'ts'},outfile:join(dir,'draft.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'real-generation-real-sql',setup(b){
 b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'fixture'}));
 b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
 b.onResolve({filter:/^@\/lib\/db$/},()=>({path:'getDb',namespace:'fixture'}));
 b.onResolve({filter:/^@\/lib\/npc\/llm$/},()=>({path:'no-provider',namespace:'fixture'}));
 b.onResolve({filter:/^@\//},a=>({path:resolve(root,'src',a.path.slice(2)+'.ts')}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='server-only'?'':a.path==='getDb'?'export const getDb=async()=>globalThis.__stephonDb;':`export const invokeNpcLlm=async()=>{throw Error('Model must not run');};export const invokeLlmForAgent=invokeNpcLlm;export const isGlobalManagedLlmConfigured=()=>false;export const getResolvedGlobalLlmModel=()=> 'disabled-fixture';`,resolveDir:root,loader:'ts'}));
}}]});
const m=await import(pathToFileURL(join(dir,'draft.mjs')));
const tables=['clients','web3Sites','web3SiteVersions','executiveAgentMemoryItems','clientNotes'].map(n=>m.schema[n]);
const dialect=new MySqlDialect();const quote=n=>'`'+n.replaceAll('`','``')+'`';
const ddl=c=>[quote(c.name),c.getSQLType(),c.notNull?'NOT NULL':'',c.default===undefined?'':'DEFAULT '+(c.default instanceof SQL?dialect.sqlToQuery(c.default).sql:pool.escape(c.default)),c.autoIncrement?'AUTO_INCREMENT':'',c.primary?'PRIMARY KEY':'',c.hasOnUpdateNow?'ON UPDATE CURRENT_TIMESTAMP':''].filter(Boolean).join(' ');
const clientId='11111111-1111-4111-8111-111111111111',siteId='22222222-2222-4222-8222-222222222222';
const input={clientId,siteId,input:{siteType:'landing',userPrompt:'Build a corporate landscaping company website with a clear consultation call to action.',businessName:'Fixture Gardens',industry:'landscaping'},generationMode:'deterministic'};
const sha=s=>createHash('sha256').update(s).digest('hex');
before(async()=>{const [[r]]=await pool.query('SELECT DATABASE() AS db');assert.equal(r.db,'skipper_step2_ci');const [rows]=await pool.query('SHOW TABLES');assert.equal(rows.length,0,'Fresh disposable database required');});
beforeEach(async()=>{
 await pool.query('DROP TABLE IF EXISTS web3_site_builder_ai_settings');
 for(const table of tables){const cfg=getTableConfig(table);await pool.query('DROP TABLE IF EXISTS '+quote(cfg.name));await pool.query('CREATE TABLE '+quote(cfg.name)+' ('+cfg.columns.map(ddl).join(',')+') ENGINE=InnoDB');}
 await db.insert(m.schema.clients).values({id:clientId,userId:7,firstName:'Fixture',lastName:'Client',email:'fixture@example.invalid',addressLine1:'Fixture Street',city:'Fixture',state:'DC',postalCode:'00000'});
 await db.insert(m.schema.web3Sites).values({id:siteId,userId:7,clientId,name:'Fixture Site',status:'DRAFT'});
});
after(async()=>{await pool.end();delete globalThis.__stephonDb;globalThis.fetch=fetchBefore;rmSync(dir,{recursive:true,force:true});});
const run=(payload=input,owner=7)=>db.transaction(tx=>m.generateStephonDraft({db:tx,adminUserId:owner,approvalId:randomUUID()},payload));
async function token(admin=true,userId=7){return new SignJWT({userId,isAdmin:admin}).setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));}
async function preview(receipt,{admin=true,userId=7,path='index.html',anonymous=false}={}){
 const req=new NextRequest('https://example.invalid'+receipt.previewUrl,{headers:anonymous?{}:{cookie:'auth-token='+await token(admin,userId)}});
 return m.GET(req,{params:Promise.resolve({versionId:receipt.versionId,file:path.split('/')})});
}
async function counts(){return {versions:(await db.select().from(m.schema.web3SiteVersions)).length,artifacts:(await db.select().from(m.schema.executiveAgentMemoryItems)).length,notes:(await db.select().from(m.schema.clientNotes)).length};}

test('real planner/generator creates saved version, private artifact and client receipt without publishing',async()=>{
 const result=await run();assert.equal(result.ok,true);const receipt=result.data;
 assert.equal(receipt.generationMeta.llmUsed,false);assert.equal(receipt.generationMeta.plannerPath,'deterministic_fallback');assert.equal(receipt.generationMeta.intelligenceStatus,'skipped');
 assert.equal(receipt.qualityStatus,'review_required');assert.equal(receipt.publication,'not_published');assert.ok(receipt.files.length>=2);assert.equal(receipt.files.filter(f=>f.path==='index.html').length,1);
 assert.deepEqual(await counts(),{versions:1,artifacts:1,notes:1});
 const [site]=await db.select().from(m.schema.web3Sites);assert.equal(site.status,'DRAFT');assert.equal(site.currentVersionId,null);
 const [version]=await db.select().from(m.schema.web3SiteVersions);assert.equal(version.ipfsCid,null);assert.equal(version.id,receipt.versionId);assert.equal(version.schemaHash,receipt.schemaHash);
 const [memory]=await db.select().from(m.schema.executiveAgentMemoryItems);assert.ok(memory.archivedAt);assert.ok(memory.expiresAt>Date.now());
 const response=await preview(receipt);assert.equal(response.status,200);const html=await response.text();assert.match(html,/Fixture Gardens|landscap/i);assert.ok(!html.includes('<script'));assert.match(html,/<style>/);assert.ok(!/<link[^>]*site\.css/.test(html));
 assert.equal(response.headers.get('x-artifact-sha256'),sha(html));assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.match(response.headers.get('cache-control'),/no-store/);
});
test('foreign owner, wrong client and published site fail before generation or draft writes',async()=>{
 await assert.rejects(()=>run(input,8),/owned/);await assert.rejects(()=>run({...input,clientId:'33333333-3333-4333-8333-333333333333'}),/owned/);
 await db.update(m.schema.web3Sites).set({status:'PUBLISHED'});await assert.rejects(()=>run(),/DRAFT/);assert.deepEqual(await counts(),{versions:0,artifacts:0,notes:0});
});
test('preview denies anonymous, member and foreign administrator sessions',async()=>{
 const {data}=await run();assert.equal((await preview(data,{anonymous:true})).status,401);assert.equal((await preview(data,{admin:false})).status,403);assert.equal((await preview(data,{userId:8})).status,404);
});
test('preview rechecks client ownership and expiry against actual stored rows',async()=>{
 const {data}=await run();await db.update(m.schema.clients).set({userId:8});assert.equal((await preview(data)).status,404);await db.update(m.schema.clients).set({userId:7});
 await db.update(m.schema.executiveAgentMemoryItems).set({expiresAt:new Date(Date.now()-86_400_000)});assert.equal((await preview(data)).status,404);
});
test('stored CSS is protected and returned with its actual immutable hash',async()=>{
 const {data}=await run();const r=await preview(data,{path:'assets/site.css'});assert.equal(r.status,200);const css=await r.text();assert.equal(r.headers.get('x-artifact-sha256'),sha(css));assert.match(r.headers.get('content-type'),/text\/css/);
 assert.equal((await preview(data,{path:'../index.html'})).status,404);
});
test('artifact corruption is refused rather than served',async()=>{
 const {data}=await run();const [memory]=await db.select().from(m.schema.executiveAgentMemoryItems);const record=JSON.parse(memory.summary);record.packed='corrupt';await db.update(m.schema.executiveAgentMemoryItems).set({summary:JSON.stringify(record)});assert.equal((await preview(data)).status,503);
});
test('nested savepoint rolls back version when artifact persistence fails even if outer dispatcher catches',async()=>{
 await pool.query('ALTER TABLE executive_agent_memory_items MODIFY title VARCHAR(1) NOT NULL');
 const result=await db.transaction(async tx=>{try{await m.generateStephonDraft({db:tx,adminUserId:7,approvalId:randomUUID()},input);return 'unexpected';}catch{return 'failed';}});
 assert.equal(result,'failed');assert.deepEqual(await counts(),{versions:0,artifacts:0,notes:0});
});
test('independent approved generations serialize version numbers without mutating current site',async()=>{
 await run();await run();const versions=await db.select().from(m.schema.web3SiteVersions);assert.deepEqual(versions.map(v=>v.version).sort(),[1,2]);
 const [site]=await db.select().from(m.schema.web3Sites);assert.equal(site.currentVersionId,null);assert.equal(site.status,'DRAFT');
});
test('private bundle removes active content and remote references before checksumming',()=>{
 const html='<html><head><script>alert(1)</script><link href="https://tracker.invalid/style.css" rel="stylesheet"></head><body onload="steal()"><form action="/api/write"></form><img src="https://tracker.invalid/pixel"><a href="https://outside.invalid">out</a><iframe src="/admin"></iframe></body></html>';
 const packed=m.artifacts.preparePrivateBundle({files:[{path:'index.html',contentType:'text/html',content:html,bytes:html.length,sha256:sha(html)}],manifest:{}},siteId);
 const [file]=m.artifacts.readPrivateBundle(packed.packed);assert.ok(!/script|iframe|onload|tracker.invalid|outside.invalid|<form/.test(file.content));assert.equal(sha(file.content),file.sha256);
});


test('configured mode refuses missing settings storage without auto-provisioning or saving a draft',async()=>{
 await assert.rejects(()=>run({...input,generationMode:'configured'}));
 assert.deepEqual(await counts(),{versions:0,artifacts:0,notes:0});
 const [tables]=await pool.query("SHOW TABLES LIKE 'web3_site_builder_ai_settings'");assert.equal(tables.length,0);
});
test('configured site mode off reuses the provider selector and remains deterministic',async()=>{
 await pool.query('CREATE TABLE web3_site_builder_ai_settings (site_id VARCHAR(36),user_id INT,llm_mode VARCHAR(16),endpoint TEXT,model TEXT,api_key_enc TEXT,fallback_to_platform INT)');
 await pool.query("INSERT INTO web3_site_builder_ai_settings VALUES (?,7,'off',NULL,NULL,NULL,0)",[siteId]);
 const result=await run({...input,generationMode:'configured'});assert.equal(result.ok,true);assert.equal(result.data.providerSource,'deterministic');assert.equal(result.data.generationMeta.llmUsed,false);
});
