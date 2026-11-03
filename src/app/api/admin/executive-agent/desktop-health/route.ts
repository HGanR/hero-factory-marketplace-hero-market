import type { NextRequest } from 'next/server';
import { getExecutiveAdminUserId } from '@/lib/admin/get-executive-admin-user-id';
import { boundedJson,healthBridge,sameOrigin } from '@/lib/desktop-health/bridge';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
  if(process.env.SMART_TRUST_HEALTH_ENABLED!=='true')return reply('Unavailable',404);
  if(!process.env.JWT_SECRET?.trim())return reply('Unavailable',503);
  try{const id=await getExecutiveAdminUserId(request);if(!id)return reply('Unauthorized',401);const cursor=request.nextUrl.searchParams.get('cursor');if(cursor&&(cursor.length>256||!/^[A-Za-z0-9_-]+$/.test(cursor)))return reply('Invalid cursor',400);return await healthBridge('operator',id,'list',cursor?{cursor}:{});}catch{return reply('Unavailable',503);}
}
export async function POST(request:NextRequest){
  if(process.env.SMART_TRUST_HEALTH_ENABLED!=='true')return reply('Unavailable',404);
  if(!process.env.JWT_SECRET?.trim())return reply('Unavailable',503);
  if(!sameOrigin(request))return reply('Same-origin request required',403);
  try{
    const id=await getExecutiveAdminUserId(request);if(!id)return reply('Unauthorized',401);
    let body;try{body=await boundedJson(request);}catch{return reply('Invalid request',400);}
    const {operation,...payload}=body;
    if(operation!=='target'&&operation!=='revoke'&&operation!=='candidates')return reply('Invalid operation',400);
    return await healthBridge('operator',id,operation,payload);
  }catch{return reply('Unavailable',503);}
}
