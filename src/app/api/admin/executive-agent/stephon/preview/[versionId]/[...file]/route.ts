import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { clients, web3Sites, web3SiteVersions, executiveAgentMemoryItems } from '@/lib/db/schema';
import { engineRouteActor, EngineAccessError } from '@/lib/security/engine-route-access';
import { previewMemoryId, readPrivateBundle, safeArtifactPath } from '@/lib/site-builder/stephon-private-artifact';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"sandbox; default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"};
export async function GET(req:NextRequest,context:{params:Promise<{versionId:string;file:string[]}>}){
  try{
    const actor=await engineRouteActor(req);
    if(!actor.admin)return Response.json({error:'Forbidden'},{status:403,headers});
    const {versionId,file}=await context.params;
    const path=file.join('/');
    if(!/^[a-f0-9-]{36}$/.test(versionId)||!safeArtifactPath(path))return Response.json({error:'Not found'},{status:404,headers});
    const db=await getDb();
    const [version]=await db.select().from(web3SiteVersions).where(eq(web3SiteVersions.id,versionId)).limit(1);
    if(!version)return Response.json({error:'Not found'},{status:404,headers});
    const [site]=await db.select().from(web3Sites).where(and(eq(web3Sites.id,version.siteId),eq(web3Sites.userId,actor.userId))).limit(1);
    const [client]=site?.clientId?await db.select({id:clients.id}).from(clients).where(and(eq(clients.id,site.clientId),eq(clients.userId,actor.userId))).limit(1):[];
    if(!site||!client)return Response.json({error:'Not found'},{status:404,headers});
    const [memory]=await db.select().from(executiveAgentMemoryItems).where(and(eq(executiveAgentMemoryItems.id,previewMemoryId(versionId)),eq(executiveAgentMemoryItems.adminUserId,actor.userId),eq(executiveAgentMemoryItems.subjectType,'stephon_private_preview'),eq(executiveAgentMemoryItems.subjectId,versionId))).limit(1);
    if(!memory||!memory.expiresAt||memory.expiresAt.getTime()<=Date.now())return Response.json({error:'Preview unavailable or expired'},{status:404,headers});
    const record=JSON.parse(memory.summary);
    if(record.versionId!==versionId||record.siteId!==site.id||record.clientId!==client.id||record.schemaHash!==version.schemaHash)throw Error('Invalid preview binding');
    const artifact=readPrivateBundle(record.packed).find(f=>f.path===path);
    if(!artifact)return Response.json({error:'Not found'},{status:404,headers});
    return new Response(artifact.content,{headers:{...headers,'Content-Type':artifact.contentType+'; charset=utf-8','X-Artifact-SHA256':artifact.sha256}});
  }catch(error){
    return Response.json({error:error instanceof EngineAccessError?error.message:'Preview unavailable'}, {status:error instanceof EngineAccessError?error.status:503,headers});
  }
}
