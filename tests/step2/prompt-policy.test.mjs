import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const root=process.cwd(), dir=mkdtempSync(join(root,".step2-prompt-"));
after(()=>rmSync(dir,{recursive:true,force:true}));
await build({stdin:{contents:`export * from './src/lib/agents/executive-admin-system-prompt.ts';export * from './src/policy/skipperCharter.ts'; export * from './src/lib/executive-agent/executive-revenue-value.ts';`,resolveDir:root,loader:"ts"},outfile:join(dir,"prompt.mjs"),bundle:true,platform:"node",format:"esm",plugins:[{name:"alias",setup(b){b.onResolve({filter:/^@\//},a=>({path:resolve(root,"src",a.path.slice(2)+".ts")}));}}]});
const m=await import(pathToFileURL(join(dir,"prompt.mjs")));
for(const [name,prompt] of [["intent planner",m.buildExecutiveIntentPlannerSystemPrompt()],["NPC executive persona",m.buildExecutiveAdminNpcLlmPersonaSection("SKIPPER")],["world executive addendum",m.buildExecutiveTrooWorldSystemAddendum()]])test(name+" uses adopted charter",()=>{
 assert.ok(prompt.includes(m.SKIPPER_CHARTER_PROMPT));assert.ok(prompt.includes("SubVendor"));assert.ok(prompt.includes("literal humanConfirmed=true"));
});

test("spoken membership numbers are explicitly modeled, not verified collections",()=>{
 const answer=m.buildRevenueOverviewVoiceAnswer(m.computeExecutiveRevenueValue({pendingAccounts:4,approvedAccounts:10}));
 assert.match(answer,/not verified billing or collections/);assert.match(answer,/Setup fees do not count toward ARR/);
 assert.match(answer,/\$620\.00/);assert.match(answer,/\$1,550\.00/);assert.match(answer,/\$200\.00/);
});
