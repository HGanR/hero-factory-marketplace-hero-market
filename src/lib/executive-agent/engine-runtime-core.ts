import { EngineRequest, ENGINE_CATALOG, resolveEngineInput, sameEngineProposal, writeActionForEngine } from './engine-runtime-contract';
export class EngineRuntimeError extends Error {
  constructor(message:string,readonly status=400){super(message);}
}
export type Approval={id:string;status:string;targetType:string|null;proposedAction:string;payloadJson:string};
export interface EnginePorts {
  get:(id:string)=>Promise<Approval|null>;
  owned:(input:Record<string,unknown>)=>Promise<void>;
  create:(id:string,engineId:string,action:string,payload:unknown,input:Record<string,unknown>)=>Promise<void>;
  claim:(id:string)=>Promise<boolean>;
  reject:(id:string)=>Promise<boolean>;
  execute:(row:Approval)=>Promise<{ok:boolean}>;
  finish:(id:string,ok:boolean)=>Promise<void>;
  receipt:(id:string)=>Promise<unknown>;
  read:(id:string,input:Record<string,unknown>)=>Promise<unknown>;
}
export async function operateEngineWithPorts(raw:unknown,ports:EnginePorts){
 const request=EngineRequest.parse(raw);
 if(request.operation==='receipt')return ports.receipt(request.requestId);
 if(request.operation==='approve'||request.operation==='reject'){
  const row=await ports.get(request.requestId);
  const engine=ENGINE_CATALOG.find(e=>'engine:'+e.id===row?.targetType&&e.mode==='approval');
  if(!row||!engine)throw new EngineRuntimeError('Engine job not found.',404);
  if(row.status!=='pending')return ports.receipt(request.requestId);
  if(request.operation==='reject'){
   await ports.reject(row.id);
   return ports.receipt(row.id);
  }
  const payload=JSON.parse(row.payloadJson) as Record<string,unknown>;
  // Validate the stored action again; a descriptor cannot widen executor authority.
  const input={...payload};delete input.mode;delete input.dryRun;
  if(!sameEngineProposal(row,engine.id,input))throw new EngineRuntimeError('Stored engine proposal is inconsistent.',409);
  await ports.owned(payload);
  if(!await ports.claim(row.id))return ports.receipt(row.id);
  const result=await ports.execute(row);
  await ports.finish(row.id,result.ok);
  return ports.receipt(row.id);
 }
 const input=resolveEngineInput(request.engineId,request.input) as Record<string,unknown>;
 await ports.owned(input);
 const engine=ENGINE_CATALOG.find(e=>e.id===request.engineId)!;
 if(request.operation==='read'){
  if(engine.mode!=='read')throw new EngineRuntimeError('Execution requires a reviewed proposal.');
  return {engineId:engine.id,status:'read_complete',observedAt:new Date().toISOString(),result:await ports.read(engine.id,input)};
 }
 if(engine.mode!=='approval')throw new EngineRuntimeError('This engine is read-only.');
 const expected=writeActionForEngine(engine.id,input);
 let row=await ports.get(request.requestId);
 if(!row){
  try{await ports.create(request.requestId,engine.id,expected.action,expected.payload,input);}
  catch{row=await ports.get(request.requestId);if(!row)throw new EngineRuntimeError('Could not record this proposal. No execution started.',409);}
  row=await ports.get(request.requestId);
 }
 if(!row||!sameEngineProposal(row,engine.id,input))throw new EngineRuntimeError('Request ID already belongs to a different proposal.',409);
 return ports.receipt(row.id);
}
