import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {NextRequest} from 'next/server.js';

const root=process.cwd(),dir=mkdtempSync(join(root,'.auth-config-'));
const saved=Object.fromEntries(['NODE_ENV','JWT_SECRET','ADMIN_USERNAME','ADMIN_PASSWORD'].map(k=>[k,process.env[k]]));
globalThis.__authConfigDbCalls=0;
await build({stdin:{contents:`export {GET,POST} from './src/app/api/admin/executive-agent/engine-runtime/route.ts';export {POST as login} from './src/app/api/admin/login/route.ts';export * as sessions from './src/lib/admin/admin-session-jwt.ts';`,resolveDir:root,loader:'ts'},outfile:join(dir,'routes.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'real-auth-routes',setup(b){
 b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
 b.onResolve({filter:/^@\/lib\/db$/},()=>({path:'db',namespace:'fixture'}));
 b.onResolve({filter:/^@\/lib\/executive-agent\/engine-runtime-service$/},()=>({path:'runtime',namespace:'fixture'}));
 b.onResolve({filter:/^@\/app\/api\/admin\/executive-agent\/approvals\//},()=>({path:'decision',namespace:'fixture'}));
 b.onResolve({filter:/^@\//},a=>({path:resolve(root,'src',a.path.slice(2)+'.ts')}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'ts',contents:a.path==='db'?`export const getDb=async()=>{globalThis.__authConfigDbCalls++;throw Error('Database must not be used by these auth checks');};`:a.path==='runtime'?`export class EngineRuntimeError extends Error{};export const operateEngine=async()=>{throw Error('Executor must not be reached');};`:`export const POST=async()=>{throw Error('Approval must not be reached');};`}));
}}]});
const m=await import(pathToFileURL(join(dir,'routes.mjs')));
after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}delete globalThis.__authConfigDbCalls;rmSync(dir,{recursive:true,force:true});});
function config(secret){process.env.NODE_ENV='production';if(secret)process.env.JWT_SECRET=secret;else delete process.env.JWT_SECRET;process.env.ADMIN_USERNAME='fixture-admin';process.env.ADMIN_PASSWORD='fixture-password';globalThis.__authConfigDbCalls=0;}
const request=(method='GET',cookie='admin-token=unverified')=>new NextRequest('https://example.invalid/api/admin/executive-agent/engine-runtime',{method,headers:{cookie,origin:'https://example.invalid'},...(method==='POST'?{body:'{}'}:{})});

test('missing deployment secret gives actionable private 503 for GET and POST with zero DB or engine access',async()=>{
 config();
 for(const method of ['GET','POST']){
   const response=await m[method](request(method));assert.equal(response.status,503);
   const data=await response.json();assert.equal(data.ok,false);assert.equal(data.code,'ADMIN_AUTH_NOT_CONFIGURED');
   assert.match(response.headers.get('cache-control'),/no-store/);assert.ok(!JSON.stringify(data).includes('fallback-secret'));
 }
 assert.equal(globalThis.__authConfigDbCalls,0);
});

test('anonymous and forged sessions remain denied and never become successful catalogs',async()=>{
 config('fixture-only-secret-not-a-deployment-value');
 assert.equal((await m.GET(request('GET',''))).status,401);
 assert.equal((await m.GET(request())).status,401);
 assert.equal(globalThis.__authConfigDbCalls,0);
});

test('admin login refuses missing secret before automatic account creation',async()=>{
 config();const response=await m.login(new NextRequest('https://example.invalid/api/admin/login',{method:'POST',body:JSON.stringify({username:'fixture-admin',password:'fixture-password'})}));
 assert.equal(response.status,503);assert.equal((await response.json()).code,'ADMIN_AUTH_NOT_CONFIGURED');
 assert.equal(response.cookies.getAll().length,0);assert.equal(globalThis.__authConfigDbCalls,0);
});

test('configured session signer and strict verifier agree without accepting fallback tokens',async()=>{
 config('fixture-only-secret-not-a-deployment-value');
 const tokens=await m.sessions.signNpcAdminSessionTokens({userId:7,username:'fixture-admin'});
 assert.equal((await m.sessions.verifyNpcAdminJwt(tokens.adminToken)).userId,7);
 assert.equal(m.sessions.npcJwtPayloadIsAdmin(await m.sessions.verifyNpcAdminJwt(tokens.adminToken)),true);
 process.env.JWT_SECRET='another-fixture-only-secret';
 assert.equal(await m.sessions.verifyNpcAdminJwt(tokens.adminToken),null);
});
