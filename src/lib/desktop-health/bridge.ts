import { createHmac, randomUUID } from 'node:crypto';

function canonical(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  const o=value as Record<string,unknown>;
  return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin&&request.headers.get('sec-fetch-site')!=='cross-site';}
export async function boundedJson(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('INVALID_REQUEST');
  // Stream limit applies even when Content-Length is missing or forged.
  const reader=request.body?.getReader();let bytes=0;const parts:Uint8Array[]=[];
  if(!reader)throw new Error('INVALID_REQUEST');
  try { for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384)throw new Error('INVALID_REQUEST');parts.push(value);} }
  finally {await reader.cancel();}
  const value=JSON.parse(Buffer.concat(parts).toString('utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
export async function healthBridge(role:'member'|'operator',memberId:number,operation:string,body:unknown):Promise<Response>{
  const secret=process.env.SMART_TRUST_HEALTH_BRIDGE_SECRET??'';
  const service=new URL(process.env.SMART_TRUST_HEALTH_SERVICE_URL??'https://unconfigured.invalid');
  if(secret.length<32||service.protocol!=='https:'||service.username||service.password||service.search||service.hash||service.hostname==='unconfigured.invalid')throw new Error('UNAVAILABLE');
  const envelope={schemaVersion:1,actor:{role,subject:'marketplace:'+memberId},operation,timestamp:Date.now(),nonce:randomUUID(),body};
  const signature=createHmac('sha256',secret).update('desktop-health-bridge-v1\n'+canonical(envelope)).digest('hex');
  const response=await fetch(service,{method:'POST',headers:{'Content-Type':'application/json','x-health-signature':signature},body:JSON.stringify(envelope),signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'});
  if(response.status===204)return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  if(!response.ok)return Response.json({error:'Health service unavailable.'},{status:response.status===429?429:503,headers:{'Cache-Control':'no-store'}});
  const reader=response.body?.getReader();if(!reader)throw new Error('UNAVAILABLE');
  let size=0;const parts:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw new Error('UNAVAILABLE');parts.push(value);}}finally{await reader.cancel();}
  return Response.json(JSON.parse(Buffer.concat(parts).toString('utf8')),{headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
}
