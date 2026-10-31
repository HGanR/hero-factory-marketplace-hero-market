import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {operateEngineWithPorts,type EnginePorts,type Approval} from './engine-runtime-core';
import {resolveEngineInput,writeActionForEngine} from './engine-runtime-contract';

function fixture(){
 const rows=new Map<string,Approval>();let runs=0;let owned=true;
 const ports:EnginePorts={
  get:async id=>rows.get(id)??null,
  owned:async()=>{if(!owned)throw Error('not owned');},
  create:async(id,engineId,action,payload)=>{if(rows.has(id))throw Error('duplicate');rows.set(id,{id,status:'pending',targetType:'engine:'+engineId,proposedAction:action,payloadJson:JSON.stringify(payload)});},
  claim:async id=>{const row=rows.get(id)!;if(row.status!=='pending')return false;row.status='approved';return true;},
  reject:async id=>{const row=rows.get(id)!;if(row.status!=='pending')return false;row.status='rejected';return true;},
  execute:async()=>{runs++;await new Promise(r=>setTimeout(r,5));return{ok:true};},
  finish:async(id,ok)=>{rows.get(id)!.status=ok?'executed':'failed';},
  receipt:async id=>{const row=rows.get(id);if(!row)throw Error('not found');return {...row};},
  read:async()=>({source:'actual adapter'})
 };
 return {ports,rows,runs:()=>runs,revoke:()=>{owned=false;}};
}
const input={clientId:'11111111-1111-4111-8111-111111111111',industry:'barbershops'};
test('proposal is durable and idempotent; concurrent approvals execute once',async()=>{
 const x=fixture(),requestId=randomUUID();
 const proposal={operation:'propose',requestId,engineId:'bentley.market_research',input};
 await operateEngineWithPorts(proposal,x.ports);await operateEngineWithPorts(proposal,x.ports);
 assert.equal(x.rows.size,1);assert.equal(x.runs(),0);
 await Promise.all(Array.from({length:4},()=>operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports)));
 assert.equal(x.runs(),1);assert.equal(x.rows.get(requestId)?.status,'executed');
 await operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports);assert.equal(x.runs(),1);
});
test('unknown fields, missing confirmation, mismatched IDs and revoked ownership fail',async()=>{
 const x=fixture(),requestId=randomUUID();
 await operateEngineWithPorts({operation:'propose',requestId,engineId:'bentley.market_research',input},x.ports);
 await assert.rejects(()=>operateEngineWithPorts({operation:'propose',requestId,engineId:'bentley.market_research',input:{...input,industry:'changed'}},x.ports));
 await assert.rejects(()=>operateEngineWithPorts({operation:'approve',requestId},x.ports));
 assert.throws(()=>resolveEngineInput('bentley.market_research',{...input,mode:'full_lifecycle'}));
 assert.throws(()=>resolveEngineInput('bentley.campaign_drafts',{campaignId:input.clientId,publish:true}));
 x.revoke();await assert.rejects(()=>operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports));assert.equal(x.runs(),0);
});
test('a descriptor cannot replace the stored executor or turn an intake into a product',async()=>{
 const x=fixture(),requestId=randomUUID();
 await operateEngineWithPorts({operation:'propose',requestId,engineId:'bentley.market_research',input},x.ports);
 x.rows.get(requestId)!.proposedAction='createSpecializedAgent';
 await assert.rejects(()=>operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports));assert.equal(x.runs(),0);
 const mapping=writeActionForEngine('stephon.intake',{clientId:input.clientId,title:'Website',instruction:'Build a website'});
 assert.equal(mapping.action,'createSiteBuilderTask');
});
test('read calls do not queue or execute and an uncertain execution is never replayed',async()=>{
 const x=fixture();const read=await operateEngineWithPorts({operation:'read',engineId:'company.analytics',input:{}},x.ports) as {result:unknown};
 assert.deepEqual(read.result,{source:'actual adapter'});assert.equal(x.rows.size,0);
 const requestId=randomUUID();await operateEngineWithPorts({operation:'propose',requestId,engineId:'bentley.market_research',input},x.ports);
 let calls=0;x.ports.execute=async()=>{calls++;throw Error('response lost');};
 await assert.rejects(()=>operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports));
 assert.equal(x.rows.get(requestId)?.status,'approved');
 await operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports);assert.equal(calls,1);
});
test('rejection is terminal and cannot be changed into an execution',async()=>{
 const x=fixture(),requestId=randomUUID();await operateEngineWithPorts({operation:'propose',requestId,engineId:'bentley.market_research',input},x.ports);
 await operateEngineWithPorts({operation:'reject',requestId,humanConfirmed:true},x.ports);
 await operateEngineWithPorts({operation:'approve',requestId,humanConfirmed:true},x.ports);
 assert.equal(x.rows.get(requestId)?.status,'rejected');assert.equal(x.runs(),0);
});
