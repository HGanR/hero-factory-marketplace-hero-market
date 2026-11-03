import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const root=process.cwd(),dir=mkdtempSync(join(root,".step2-api-"));
const savedEnv={...process.env};
after(()=>{rmSync(dir,{recursive:true,force:true});delete globalThis.__step2api;for(const key of Object.keys(process.env))if(!(key in savedEnv))delete process.env[key];Object.assign(process.env,savedEnv);});
globalThis.__step2api={admin:7,rows:[],opts:null,dbReads:0,owner:7,runs:0};
const g=globalThis.__step2api;
await build({stdin:{contents:`export {GET as approvals} from './src/app/api/admin/executive-agent/approvals/route.ts'; export {POST as cron} from './src/app/api/cron/revenue-loop/route.ts'; export {rejectExecutiveAction} from './src/lib/executive-agent/reject-executive-action.ts'; export {approveExecutiveAction} from './src/lib/executive-agent/approve-executive-action.ts';`,resolveDir:root,loader:"ts"},outfile:join(dir,"api.mjs"),bundle:true,platform:"node",format:"esm",packages:"external",plugins:[{name:"HTTP-dependency-fixtures",setup(b){
 b.onResolve({filter:/^drizzle-orm/},a=>({path:a.path,external:true}));
 b.onResolve({filter:/^next\/server$/},()=>({path:"next",namespace:"fixture"}));
 b.onResolve({filter:/^@\//},a=>{
   if(["@/lib/admin/get-executive-admin-user-id","@/lib/db","@/lib/db/schema","@/lib/executive-agent/executive-agent-approvals-store","@/lib/executive-agent/revenue-loop"].includes(a.path))return{path:a.path,namespace:"fixture"};
   return {path:resolve(root,"src",a.path.slice(2)+".ts")};
 });
 b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:a.path==="next"?"export const NextResponse=Response;":a.path.endsWith("get-executive-admin-user-id")?"export async function getExecutiveAdminUserId(){return globalThis.__step2api.admin}":a.path.endsWith("/schema")?"import {mysqlTable,int,varchar} from 'drizzle-orm/mysql-core'; export const marketplaceUsers=mysqlTable('marketplace_users',{id:int('id'),username:varchar('username',{length:100})});":a.path.endsWith("/db")?"export async function getDb(){globalThis.__step2api.dbReads++;return {select(){return {from(){return {where(){return {limit:async()=>globalThis.__step2api.owner?[{id:globalThis.__step2api.owner}]:[]}}}}}}}}":a.path.endsWith("approvals-store")?"export async function listExecutiveApprovals(db,opts){globalThis.__step2api.opts=opts;return globalThis.__step2api.rows}":"export async function runRevenueLoop(id){globalThis.__step2api.runs++;return {skipped:false,proposed:1}}"}));
}}]});
const m=await import(pathToFileURL(join(dir,"api.mjs")));
const request=(url,token)=>{const req=new Request(url,{headers:token?{authorization:"Bearer "+token}:{}});Object.defineProperty(req,"nextUrl",{value:new URL(url)});return req;};
test("approval retrieval requires authenticated admin before reading persistence",async()=>{g.admin=null;g.dbReads=0;const response=await m.approvals(request("http://localhost/approvals"));assert.equal(response.status,401);assert.equal(g.dbReads,0);g.admin=7;});
test("Website and Desktop read one versioned queue retaining every stored status",async()=>{
 for(const status of ["pending","approved","rejected","executed","failed"]){g.rows=[{id:"stored",proposedAction:"triggerCampaignSync",status,payloadJson:'{"campaignId":"c"}',createdAt:new Date("2026-11-03T00:00:00Z")}];const response=await m.approvals(request("http://localhost/approvals?status="+status));const body=await response.json();assert.equal(g.opts.adminUserId,7);assert.equal(g.opts.status,status);assert.equal(body.queue[0].status,status);assert.equal(body.queue[0].category,"bentley");assert.equal(body.approvals[0].status,status);assert.equal(body.schemaVersion,"skipper-proposal-v1");assert.equal(response.headers.get("cache-control"),"private, no-store");}
});
test("cron rejects absent secret before any database access",async()=>{process.env.CRON_SECRET="unit-cron-secret";g.dbReads=0;const response=await m.cron(request("http://localhost/cron"));assert.equal(response.status,401);assert.equal(g.dbReads,0);});
test("authorized cron remains disabled by default",async()=>{delete process.env.SKIPPER_REVENUE_LOOP_ENABLED;g.runs=0;const response=await m.cron(request("http://localhost/cron","unit-cron-secret"));assert.equal((await response.json()).reason,"disabled");assert.equal(g.runs,0);});
test("enabled cron requires configured owner and verified database identity",async()=>{process.env.SKIPPER_REVENUE_LOOP_ENABLED="true";delete process.env.SKIPPER_REVENUE_LOOP_ADMIN_USER_ID;assert.equal((await m.cron(request("http://localhost/cron","unit-cron-secret"))).status,503);process.env.SKIPPER_REVENUE_LOOP_ADMIN_USER_ID="7";process.env.ADMIN_USERNAME="unit-admin";g.owner=null;assert.equal((await m.cron(request("http://localhost/cron","unit-cron-secret"))).status,503);assert.equal(g.runs,0);});
test("configured authenticated cron delegates once to propose-only coordinator",async()=>{g.owner=7;const response=await m.cron(request("http://localhost/cron","unit-cron-secret"));assert.equal(response.status,200);assert.equal((await response.json()).proposed,1);assert.equal(g.runs,1);});

test("Website rejection is visible in the next Desktop API read",async()=>{
 const row={id:"shared",adminUserId:7,proposedAction:"createTodo",status:"pending",payloadJson:"{}",createdAt:new Date()};g.rows=[row];g.admin=7;
 const before=await (await m.approvals(request("http://localhost/approvals"))).json();assert.equal(before.queue[0].status,"pending");
 const rejection=new Request("http://localhost/reject",{method:"POST",body:JSON.stringify({humanConfirmed:true})});
 const result=await m.rejectExecutiveAction(rejection,row.id,7,{read:async()=>row,auditRefusal:async()=>{},rejectPending:async()=>{if(row.status!=="pending")return false;row.status="rejected";return true;}});assert.equal(result.status,200);
 const after=await (await m.approvals(request("http://localhost/approvals"))).json();assert.equal(after.queue[0].status,"rejected");
});
test("Desktop approval execution state is visible in the next Website API read",async()=>{
 const row={id:"shared",adminUserId:7,proposedAction:"createTodo",status:"pending",payloadJson:"{}",createdAt:new Date()};g.rows=[row];g.admin=7;let executions=0;
 const approval=()=>new Request("http://localhost/approve",{method:"POST",body:JSON.stringify({humanConfirmed:true})});
 const deps={read:async()=>row,auditRefusal:async()=>{},claim:async()=>{if(row.status!=="pending")return false;row.status="approved";return true;},execute:async()=>{executions++;row.status="executed";return {ok:true,status:"executed",message:"fixture execution"};}};
 assert.equal((await m.approveExecutiveAction(approval(),row.id,7,deps)).status,200);
 const after=await (await m.approvals(request("http://localhost/approvals"))).json();assert.equal(after.queue[0].status,"executed");
 assert.equal((await m.approveExecutiveAction(approval(),row.id,7,deps)).status,409);assert.equal(executions,1);
});
