import type { NextRequest } from 'next/server';
import { healthMemberId } from '@/lib/desktop-health/member';
import { boundedJson,healthBridge,sameOrigin } from '@/lib/desktop-health/bridge';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
type Context={params:Promise<{operation:string}>};
export async function GET(request:NextRequest,context:Context){
  if(process.env.SMART_TRUST_HEALTH_ENABLED!=='true')return reply('Unavailable',404);
  if((await context.params).operation!=='session')return reply('Unavailable',404);
  try{const id=await healthMemberId(request);return id?Response.json({memberId:id},{headers:{'Cache-Control':'no-store','Vary':'Cookie'}}):reply('Member session required',401);}catch{return reply('Unavailable',503);}
}
export async function POST(request:NextRequest,context:Context){
  if(process.env.SMART_TRUST_HEALTH_ENABLED!=='true')return reply('Unavailable',404);
  const {operation}=await context.params;
  if(!['report','decision'].includes(operation))return reply('Unavailable',404);
  if(!sameOrigin(request))return reply('Same-origin request required',403);
  try{
    const id=await healthMemberId(request);if(!id)return reply('Member session required',401);
    let body;try{body=await boundedJson(request);}catch{return reply('Invalid request',400);}
    if(operation==='report'){
      if(body.expectedMemberId!==id||Object.keys(body).some(k=>!['expectedMemberId','report'].includes(k)))return reply('Account changed; sign in again',409);
      return await healthBridge('member',id,operation,body.report);
    }
    return await healthBridge('member',id,operation,body);
  }catch{return reply('Unavailable',503);}
}
