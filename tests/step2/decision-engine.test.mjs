import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const root = process.cwd();
const dir = mkdtempSync(join(root, ".step2-unit-"));
after(() => rmSync(dir, { recursive: true, force: true }));
await build({ stdin: { contents: `export * from './src/lib/executive-agent/revenue-loop-core.ts'; export * from './src/lib/executive-agent/reject-executive-action.ts'; export * from './src/approvals/unifiedApproval.ts'; export * from './src/policy/skipperCharter.ts';`, resolveDir: root, loader: "ts" }, outfile: join(dir, "unit.mjs"), bundle: true, platform: "node", format: "esm", packages: "external" });
const { runRevenueLoopCore, rejectExecutiveAction, toUnifiedApproval, SKIPPER_CHARTER, SKIPPER_CHARTER_PROMPT } = await import(pathToFileURL(join(dir,"unit.mjs")));
const now = new Date("2026-11-03T08:00:00Z");
const initial = () => ({ forwardCursor: null, catchUpCursor: null, lastRunAt: null });
function fixture() {
  const state = { receipts: new Set(), proposals: new Map(), saved: null, calls: [] };
  const deps = {
    catalog: [{ id:"membership", verifiedPricing:true, monthlyUsd:20, mock:false, paymentVerificationBlocked:false }],
    readPage: async (cursor, at) => { state.calls.push([cursor, at]); return {events:[],nextCursor:cursor}; },
    hasReceipt: async id => state.receipts.has(id), saveReceipt: async id => { state.receipts.add(id); },
    reconcileSources: async () => ({pending:17,approved:34,reviews:[{kind:"pending_membership",subjectId:"9",evidence:"database"}]}),
    propose: async review => { const key=review.kind+review.subjectId; if(state.proposals.has(key)) return false; state.proposals.set(key, {status:"pending",review}); return true; },
    saveState: async value => {state.saved=value;},
  };
  return {state,deps};
}
test("daily run creates pending reviews, not execution or collected revenue", async()=>{
  const {state,deps}=fixture(); const result=await runRevenueLoopCore(initial(),deps,now);
  assert.equal(result.proposed,1);assert.equal(state.proposals.values().next().value.status,"pending");
  assert.equal(result.billing.verifiedCollectedRevenue,null);assert.equal(result.billing.membershipChargingVerified,false);
  assert.deepEqual(result.metrics,{source:"database",pendingAccounts:17,approvedActiveAccounts:34});
});
test("daily cadence avoids repeat reads and proposals",async()=>{
  const {state,deps}=fixture();const result=await runRevenueLoopCore({...initial(),lastRunAt:now.toISOString()},deps,now);
  assert.equal(result.skipped,true);assert.equal(state.calls.length,0);assert.equal(state.saved,null);
});
for (const [name,change] of [["unpriced",{monthlyUsd:null}],["mock",{mock:true}],["unverified pricing",{verifiedPricing:false}],["blocked payment verification",{paymentVerificationBlocked:true}],["TROO",{id:"troo"}],["nonfinite price",{monthlyUsd:Infinity}]]) {
  test(name+" cannot create membership revenue proposals",async()=>{
    const {state,deps}=fixture();Object.assign(deps.catalog[0],change);const result=await runRevenueLoopCore(initial(),deps,now);
    assert.equal(result.proposed,0);assert.equal(state.proposals.size,0);
  });
}
test("catch-up starts at independent checkpoint and drains every page",async()=>{
  const {state,deps}=fixture();const event=id=>({id,eventType:"new_account",createdAt:"2026-11-03T06:00:00Z"});
  state.receipts.add("already-seen");
  deps.readPage=async(cursor,at)=>{state.calls.push([cursor,at]);return cursor==="catchup-old"?{events:[event("late")],nextCursor:"catchup-page2"}:cursor==="catchup-page2"?{events:[event("already-seen")],nextCursor:"catchup-end"}:{events:[],nextCursor:cursor};};
  const result=await runRevenueLoopCore({forwardCursor:"forward-new",catchUpCursor:"catchup-old",lastRunAt:null},deps,now);
  assert.deepEqual(state.calls.map(c=>c[0]),["forward-new","catchup-old","catchup-page2","catchup-end"]);
  assert.equal(result.newEvents,1);assert.equal(state.saved.forwardCursor,"forward-new");
  const checkpoint=JSON.parse(Buffer.from(state.saved.catchUpCursor,"base64url"));
  assert.deepEqual(checkpoint,{c:"2026-11-03T07:59:30.000Z",i:""});
  assert.ok(state.calls.every(([,at])=>at===now));
});
test("duplicate feed event on both cursor chains is receipted once",async()=>{
  const {state,deps}=fixture();deps.readPage=async cursor=>cursor===null?{events:[{id:"e",eventType:"new_account",createdAt:now.toISOString()}],nextCursor:"end"}:{events:[],nextCursor:cursor};
  const result=await runRevenueLoopCore(initial(),deps,now);assert.equal(result.newEvents,1);assert.equal(state.receipts.size,1);
});
test("stalled cursor fails without advancing checkpoint",async()=>{
  const {state,deps}=fixture();deps.readPage=async cursor=>({events:[{id:"e"}],nextCursor:cursor});
  await assert.rejects(()=>runRevenueLoopCore(initial(),deps,now),/did not advance/);assert.equal(state.saved,null);
});
test("page budget fails without silently skipping remaining events",async()=>{
  const {state,deps}=fixture();let n=0;deps.readPage=async()=>({events:[{id:String(n)}],nextCursor:String(++n)});
  await assert.rejects(()=>runRevenueLoopCore(initial(),deps,now),/page budget/);assert.equal(state.saved,null);
});
test("source failure cannot commit a successful catch-up checkpoint",async()=>{
  const {state,deps}=fixture();deps.reconcileSources=async()=>{throw Error("database unavailable");};
  await assert.rejects(()=>runRevenueLoopCore(initial(),deps,now),/unavailable/);assert.equal(state.saved,null);assert.equal(state.proposals.size,0);
});
test("source reconciliation works even with an empty or incomplete feed",async()=>{
  const {state,deps}=fixture();await runRevenueLoopCore(initial(),deps,now);assert.equal(state.proposals.size,1);
});
test("durable proposal keys do not reopen a rejected proposal next day",async()=>{
  const {state,deps}=fixture();await runRevenueLoopCore(initial(),deps,now);state.proposals.get("pending_membership9").status="rejected";
  const result=await runRevenueLoopCore(state.saved,deps,new Date(now.getTime()+86400000));assert.equal(result.proposed,0);
});
const row=(status="pending",adminUserId=7)=>({id:"stored",adminUserId,proposedAction:"createTodo",status,payloadJson:"{}",createdAt:now,executedAt:null,targetType:null,targetId:null});
function rejectFixture(r=row()) { const log=[];let claimed=0;return {log,get claimed(){return claimed;},deps:{read:async()=>r,auditRefusal:async x=>{log.push(x);},rejectPending:async()=>{claimed++;return true;}}}; }
const request=humanConfirmed=>new Request("http://localhost/reject",{method:"POST",body:JSON.stringify({humanConfirmed})});
for(const value of [undefined,false,"true",1,null])test("rejection refuses confirmation "+JSON.stringify(value),async()=>{const f=rejectFixture();const res=await rejectExecutiveAction(request(value),"stored",7,f.deps);assert.equal(res.status,400);assert.equal(f.claimed,0);assert.equal(f.log.length,1);});
test("foreign admin cannot reject",async()=>{const f=rejectFixture();const res=await rejectExecutiveAction(request(true),"stored",8,f.deps);assert.equal(res.status,403);assert.equal(f.claimed,0);});
for(const status of ["approved","rejected","executed","failed"])test("rejection refuses terminal or claimed status "+status,async()=>{const f=rejectFixture(row(status));assert.equal((await rejectExecutiveAction(request(true),"stored",7,f.deps)).status,409);assert.equal(f.claimed,0);});
test("owning confirmed rejection uses pending CAS",async()=>{const f=rejectFixture();assert.equal((await rejectExecutiveAction(request(true),"stored",7,f.deps)).status,200);assert.equal(f.claimed,1);});
test("lost rejection race returns conflict",async()=>{const f=rejectFixture();f.deps.rejectPending=async()=>false;assert.equal((await rejectExecutiveAction(request(true),"stored",7,f.deps)).status,409);});
test("refusal audit failure cannot change the row",async()=>{const f=rejectFixture();f.deps.auditRefusal=async()=>{throw Error("audit failed");};await assert.rejects(()=>rejectExecutiveAction(request(false),"stored",7,f.deps));assert.equal(f.claimed,0);});
test("queue maps Bentley, code, outreach and operations without dropping statuses",()=>{
  for(const [action,category] of [["triggerCampaignSync","bentley"],["createSiteBuilderTask","code"],["assignFollowUp","outreach"],["recordRevenueOpportunityReview","operations"]]) for(const status of ["pending","approved","rejected","executed","failed"]) {
    const dto=toUnifiedApproval({...row(status),proposedAction:action});assert.equal(dto.status,status);assert.equal(dto.category,category);assert.equal(dto.schemaVersion,"skipper-proposal-v1");assert.equal(dto.createdAt,now.toISOString());
  }
});
test("charter policy is versioned and does not equate approved accounts with billing",()=>{
  assert.equal(SKIPPER_CHARTER.version,"1.0");assert.equal(SKIPPER_CHARTER.goal.annualRecurringRevenueUsd,1000000);
  assert.deepEqual(SKIPPER_CHARTER.goal.excluded,["SubVendor"]);assert.equal(SKIPPER_CHARTER.goal.billingVerified,false);
  assert.equal(SKIPPER_CHARTER.duties.length,6);assert.equal(SKIPPER_CHARTER.limits.length,10);
  assert.ok(SKIPPER_CHARTER_PROMPT.includes("literal humanConfirmed=true"));assert.ok(SKIPPER_CHARTER_PROMPT.includes("passive/diagnostic"));
});
