import { createHash,randomUUID } from 'node:crypto';
import { and,eq } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from '@/lib/db/schema';
import { clients,trusts,trustAssets,executiveAgentMemoryItems,clientNotes } from '@/lib/db/schema';
import { GenerateQrInputSchema } from './qr-artifact-contract';
import { renderQrArtifact,qrMemoryId } from './qr-artifact-renderer';
import type { ExecutiveActionExecutorResult } from './executive-action-executors';

type Db=MySql2Database<typeof schema>;
export async function generateQrCode(ctx:{db:Db;adminUserId:number;approvalId:string},raw:unknown):Promise<ExecutiveActionExecutorResult>{
  const input=GenerateQrInputSchema.parse(raw);
  const owned=async(db:Db)=>{
    const [workspace]=await db.select().from(trusts).where(and(eq(trusts.id,input.workspaceId),eq(trusts.userId,ctx.adminUserId),eq(trusts.clientId,input.clientId))).limit(1);
    const [client]=await db.select({id:clients.id}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.userId,ctx.adminUserId))).limit(1);
    if(!workspace||!client)throw Error('An owned client-linked workspace is required.');
  };
  await owned(ctx.db);
  const h=createHash('sha256').update('qr-asset:'+ctx.approvalId).digest('hex');
  const assetId=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
  const {receipt,record}=await renderQrArtifact(input,assetId,ctx.approvalId);
  // Savepoint protects all linked rows even when the canonical dispatcher catches failure.
  await ctx.db.transaction(async tx=>{
    const [workspace]=await tx.select().from(trusts).where(and(eq(trusts.id,input.workspaceId),eq(trusts.userId,ctx.adminUserId),eq(trusts.clientId,input.clientId))).limit(1).for('update');
    const [client]=await tx.select({id:clients.id}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.userId,ctx.adminUserId))).limit(1).for('update');
    if(!workspace||!client)throw Error('Workspace ownership changed during generation.');
    await tx.insert(trustAssets).values({id:assetId,trustId:workspace.id,assetType:'qr_code',description:JSON.stringify({type:'qr_code',url:receipt.url,token:receipt.token,uniqueMode:receipt.uniqueMode,createdAt:new Date().toISOString(),name:input.name,artifactId:assetId,receipt})});
    await tx.insert(executiveAgentMemoryItems).values({id:qrMemoryId(assetId),adminUserId:ctx.adminUserId,memoryType:'system_note',source:'system',subjectType:'qr_private_artifact',subjectId:assetId,title:'Private QR files',summary:record,archivedAt:new Date()});
    await tx.insert(clientNotes).values({id:randomUUID(),clientId:client.id,createdByUserId:ctx.adminUserId,visibility:'internal',note:JSON.stringify(receipt)});
  });
  return {ok:true,status:'executed',message:'QR PNG and SVG saved privately and decoded to the intended URL. Test the intended scanner/print size; destination content was not verified.',data:receipt};
}
