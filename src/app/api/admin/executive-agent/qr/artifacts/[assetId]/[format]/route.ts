import type { NextRequest } from 'next/server';
import { and,eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { clients,trusts,trustAssets,executiveAgentMemoryItems } from '@/lib/db/schema';
import { engineRouteActor,EngineAccessError } from '@/lib/security/engine-route-access';
import { qrMemoryId,readQrArtifact } from '@/lib/executive-agent/qr-artifact-renderer';
import { qrArtifactPrefix } from '@/lib/executive-agent/qr-artifact-contract';

export const dynamic='force-dynamic',runtime='nodejs';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"sandbox; default-src 'none'; script-src 'none'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
export async function GET(req:NextRequest,context:{params:Promise<{assetId:string;format:string}>}){
  try{
    const actor=await engineRouteActor(req);
    if(!actor.admin)return Response.json({error:'Forbidden'},{status:403,headers});
    const {assetId,format}=await context.params;
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/.test(assetId)||!['png','svg'].includes(format))return Response.json({error:'Not found'},{status:404,headers});
    const db=await getDb();
    const [asset]=await db.select().from(trustAssets).where(and(eq(trustAssets.id,assetId),eq(trustAssets.assetType,'qr_code'))).limit(1);
    const [workspace]=asset?await db.select().from(trusts).where(and(eq(trusts.id,asset.trustId),eq(trusts.userId,actor.userId))).limit(1):[];
    const [client]=workspace?.clientId?await db.select({id:clients.id}).from(clients).where(and(eq(clients.id,workspace.clientId),eq(clients.userId,actor.userId))).limit(1):[];
    if(!asset||!workspace||!client)return Response.json({error:'Not found'},{status:404,headers});
    const [memory]=await db.select().from(executiveAgentMemoryItems).where(and(eq(executiveAgentMemoryItems.id,qrMemoryId(assetId)),eq(executiveAgentMemoryItems.adminUserId,actor.userId),eq(executiveAgentMemoryItems.subjectType,'qr_private_artifact'),eq(executiveAgentMemoryItems.subjectId,assetId))).limit(1);
    if(!memory)return Response.json({error:'Not found'},{status:404,headers});
    const {receipt,files}=readQrArtifact(memory.summary);
    const config=JSON.parse(asset.description||'{}');
    if(receipt.qrAssetId!==assetId||receipt.workspaceId!==workspace.id||receipt.clientId!==client.id||config.artifactId!==assetId||JSON.stringify(config.receipt)!==JSON.stringify(receipt)||receipt[format].pointer!==qrArtifactPrefix(assetId)+format)throw Error('Invalid artifact binding');
    const kind=format as 'png'|'svg';
    return new Response(new Uint8Array(files[kind]),{headers:{...headers,'Content-Type':kind==='png'?'image/png':'image/svg+xml; charset=utf-8',
      'Content-Disposition':`attachment; filename="qr_${assetId.slice(0,8)}.${kind}"`,'X-Artifact-SHA256':receipt[kind].sha256}});
  }catch(error){return Response.json({error:error instanceof EngineAccessError?error.message:'QR artifact unavailable'}, {status:error instanceof EngineAccessError?error.status:503,headers});}
}
