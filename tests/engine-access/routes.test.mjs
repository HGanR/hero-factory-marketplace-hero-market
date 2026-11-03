import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server.js';
import { getTableName } from 'drizzle-orm';

// Explicit test fixture only. Never read deployment credentials or contact a server.
process.env.JWT_SECRET='local-fixture-engine-access-not-a-deployment-secret';
process.env.NODE_ENV='production';
const root=process.cwd(),dir=mkdtempSync(join(root,'.engine-access-'));
const adapters={
 'next/headers':'export const cookies=async()=>globalThis.__access.pageCookies;',
 'next/navigation':"export const redirect=path=>{throw Object.assign(new Error('Redirect'),{kind:'redirect',path});};export const notFound=()=>{throw Object.assign(new Error('Not found'),{kind:'not-found'});};",
 '@/lib/db':'export const getConnection=async()=>{globalThis.__access.opens++;return globalThis.__access.connection;};export const getDb=async()=>{globalThis.__access.opens++;return globalThis.__access.db;};',
 '@/lib/db/schema':`import {mysqlTable,varchar} from 'drizzle-orm/mysql-core';
 export const trooWorlds=mysqlTable('troo_worlds',{id:varchar('id',{length:36})});
 export const trooWorldPlacements=mysqlTable('troo_world_placements',{id:varchar('id',{length:36}),worldId:varchar('worldId',{length:36}),elementKey:varchar('elementKey',{length:80})});
 export const meetingNodePlacements=mysqlTable('meeting_node_placements',{id:varchar('id',{length:36})});
 export const meetingInvites=mysqlTable('meeting_invites',{id:varchar('id',{length:36})});`,
};
await build({stdin:{contents:`export * as certificates from './src/app/api/certificates/route.ts';export * as placements from './src/app/api/admin/troo-world/placements/route.ts';export {default as editorLayout} from './src/app/green-terrain/layout.tsx';`,resolveDir:root,loader:'ts'},outfile:join(dir,'routes.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'real-routes-and-real-jwt',setup(b){
 b.onResolve({filter:/^next\/(headers|navigation)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
 b.onResolve({filter:/^@\//},a=>adapters[a.path]?{path:a.path,namespace:'fixture'}:{path:resolve(root,'src',a.path.slice(2)+'.ts')});
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:adapters[a.path],loader:'ts',resolveDir:root}));
}}]});
const {certificates,placements,editorLayout}=await import(pathToFileURL(join(dir,'routes.mjs')));
after(()=>{rmSync(dir,{recursive:true,force:true});delete globalThis.__access;});
const wallet='0x'+'1'.repeat(40),otherWallet='0x'+'2'.repeat(40);
async function token(payload={userId:7,isAdmin:false},secret=process.env.JWT_SECRET){return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(new TextEncoder().encode(secret));}
function setup(){
 const f={opens:0,sql:[],writes:[],verified:true,linkedUser:7,linkedWallet:wallet,fail:false};
 f.connection={execute:async(sql,params)=>{
   f.sql.push({sql,params});if(f.fail)throw Error('mysql://user:private-password@private-host');
   if(sql.startsWith('SELECT links.id')){
     assert.match(sql,/identity_row.userId = \?/);assert.match(sql,/links.verifiedAt IS NOT NULL/);assert.match(sql,/links.chain = 'evm'/);
     return [f.verified&&params[0]===f.linkedUser&&params[1]===f.linkedWallet?[{id:'verified-link'}]:[]];
   }
   if(sql.startsWith('INSERT')){f.writes.push({sql,params});return [{affectedRows:1}];}
   assert.match(sql,/^SELECT/);return [[{id:1,wallet_address:wallet}]];
 }};
 f.db={select:()=>{let table;return {from(t){table=getTableName(t);return this;},where(){return this;},limit:async()=>table==='troo_worlds'?[{id:'default'}]:[],then(resolve){return Promise.resolve([]).then(resolve);}};},insert:()=>({values:async row=>{f.writes.push(row);}})};
 globalThis.__access=f;return f;
}
function req(path,{method='GET',jwt,body,origin='https://example.invalid'}={}){
 const headers={origin};if(jwt)headers.cookie=`auth-token=${jwt}`;
 return new NextRequest('https://example.invalid'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const certificateBody={walletAddress:wallet,sealDataUrl:'data:image/png;base64,fixture',watermarkDataUrl:'data:image/png;base64,fixture',qrDataUrl:'data:image/png;base64,fixture',barcodeDataUrl:'data:image/png;base64,fixture',noticeQrDataUrl:'data:image/png;base64,fixture'};

test('anonymous certificate GET/POST stop before opening database or changing schema',async()=>{
 const f=setup();assert.equal((await certificates.GET(req('/api/certificates?wallet='+wallet))).status,401);
 assert.equal((await certificates.POST(req('/api/certificates',{method:'POST',body:certificateBody}))).status,401);assert.equal(f.opens,0);assert.equal(f.writes.length,0);
});
test('tampered JWT and known fallback-secret forgery are refused',async()=>{
 const f=setup();for(const jwt of ['invalid',await token({userId:7,isAdmin:true},'fallback-secret')]){
  assert.equal((await certificates.POST(req('/api/certificates',{method:'POST',jwt,body:certificateBody}))).status,401);
  assert.equal((await placements.PUT(req('/api/admin/troo-world/placements',{method:'PUT',jwt,body:{placements:[]}}))).status,401);
 }assert.equal(f.opens,0);
});
test('verified member can save and read only its verified linked wallet',async()=>{
 const f=setup(),jwt=await token();
 assert.equal((await certificates.POST(req('/api/certificates',{method:'POST',jwt,body:certificateBody}))).status,200);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].params[0],wallet);
 const response=await certificates.GET(req('/api/certificates?wallet='+wallet,{jwt}));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.ok(f.sql.every(row=>!/^(CREATE|ALTER|DROP)\b/.test(row.sql)));
});
for(const [name,change] of [['unverified link',f=>{f.verified=false;}],['other member',f=>{f.linkedUser=8;}],['foreign wallet',f=>{f.linkedWallet=otherWallet;}]])test(name+' cannot read or write certificates',async()=>{
 const f=setup();change(f);const jwt=await token();
 assert.equal((await certificates.GET(req('/api/certificates?wallet='+wallet,{jwt}))).status,403);
 assert.equal((await certificates.POST(req('/api/certificates',{method:'POST',jwt,body:certificateBody}))).status,403);
 assert.equal(f.writes.length,0);assert.ok(f.sql.every(row=>row.sql.startsWith('SELECT links.id')));
});
test('administrator can retain legacy certificate workflow without claiming a wallet proof',async()=>{
 const f=setup();f.verified=false;const jwt=await token({userId:7,isAdmin:true});
 assert.equal((await certificates.POST(req('/api/certificates',{method:'POST',jwt,body:certificateBody}))).status,200);
 assert.equal(f.writes.length,1);assert.equal(f.sql.length,1);assert.match(f.sql[0].sql,/^INSERT/);
});
test('cross-origin certificate and shared-world mutations are denied before database access',async()=>{
 const f=setup(),jwt=await token({userId:7,isAdmin:true});
 assert.equal((await certificates.POST(req('/api/certificates',{method:'POST',jwt,body:certificateBody,origin:'https://foreign.invalid'}))).status,403);
 assert.equal((await placements.PUT(req('/api/admin/troo-world/placements',{method:'PUT',jwt,body:{placements:[]},origin:'https://foreign.invalid'}))).status,403);assert.equal(f.opens,0);
});
test('ordinary member cannot seed/list admin worlds or overwrite public green terrain',async()=>{
 const f=setup(),jwt=await token();
 assert.equal((await placements.GET(req('/api/admin/troo-world/placements',{jwt}))).status,403);
 assert.equal((await placements.PUT(req('/api/admin/troo-world/placements',{method:'PUT',jwt,body:{worldId:'green-terrain',replace:true,placements:[]}}))).status,403);
 assert.equal(f.opens,0);assert.equal(f.writes.length,0);
});
test('administrator still saves shared-world placements',async()=>{
 const f=setup(),jwt=await token({userId:7,isAdmin:true});
 const r=await placements.PUT(req('/api/admin/troo-world/placements',{method:'PUT',jwt,body:{worldId:'green-terrain',placements:[{elementKey:'fixture',glbUrl:'/models/fixture.glb',posX:0,posY:0,posZ:0,scale:1,rotY:0}]}}));
 assert.equal(r.status,200);assert.equal(f.writes.length,1);assert.equal(f.writes[0].worldId,'green-terrain');
});
test('missing production JWT secret fails closed before database access',async()=>{
 const f=setup(),jwt=await token({userId:7,isAdmin:true}),secret=process.env.JWT_SECRET;delete process.env.JWT_SECRET;
 try{assert.equal((await certificates.GET(req('/api/certificates?wallet='+wallet,{jwt}))).status,503);assert.equal(f.opens,0);}finally{process.env.JWT_SECRET=secret;}
});
test('SQL errors are redacted and do not expose connection secrets',async()=>{
 const f=setup();f.fail=true;const response=await certificates.GET(req('/api/certificates?wallet='+wallet,{jwt:await token()}));
 assert.equal(response.status,503);const body=await response.text();assert.ok(!body.includes('private-password'));assert.ok(!body.includes('private-host'));
});


test('editor page redirects anonymous users before returning protected content',async()=>{
 const f=setup();f.pageCookies=req('/green-terrain').cookies;
 await assert.rejects(()=>editorLayout({children:'protected-editor'}),error=>error.kind==='redirect'&&error.path==='/admin');assert.equal(f.opens,0);
});
test('editor page refuses signed-in members and forged administrator tokens',async()=>{
 const f=setup();f.pageCookies=req('/green-terrain',{jwt:await token()}).cookies;
 await assert.rejects(()=>editorLayout({children:'protected-editor'}),error=>error.kind==='not-found');
 f.pageCookies=req('/green-terrain',{jwt:await token({userId:7,isAdmin:true},'fallback-secret')}).cookies;
 await assert.rejects(()=>editorLayout({children:'protected-editor'}),error=>error.kind==='redirect');assert.equal(f.opens,0);
});
test('editor page permits the authenticated platform administrator',async()=>{
 const f=setup();f.pageCookies=req('/green-terrain',{jwt:await token({userId:7,isAdmin:true})}).cookies;
 assert.equal(await editorLayout({children:'protected-editor'}),'protected-editor');assert.equal(f.opens,0);
});
test('editor page fails closed when production JWT configuration is absent',async()=>{
 const f=setup(),secret=process.env.JWT_SECRET;
 f.pageCookies=req('/green-terrain',{jwt:await token({userId:7,isAdmin:true})}).cookies;delete process.env.JWT_SECRET;
 try{await assert.rejects(()=>editorLayout({children:'protected-editor'}),/JWT_SECRET/);assert.equal(f.opens,0);}finally{process.env.JWT_SECRET=secret;}
});
