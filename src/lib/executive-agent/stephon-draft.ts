import { randomUUID, createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from '@/lib/db/schema';
import { clients, web3Sites, web3SiteVersions, executiveAgentMemoryItems, clientNotes } from '@/lib/db/schema';
import { GenerateStephonDraftSchema } from './stephon-draft-contract';
import { runFullSiteGeneration } from '@/lib/site-builder/ai/full-generation';
import { selectSiteBuilderLlmInvoke } from '@/lib/site-builder/ai/providers/select-provider';
import { generateStaticBundle } from '@/lib/site-builder/static-generator';
import { hashSiteSchema } from '@/lib/site-builder/hash';
import { SitePlannerInputSchema } from '@/lib/site-builder/ai/schemas';
import { SiteSchemaDocument } from '@/lib/site-builder/schema';
import { assertTextFits, preparePrivateBundle, PREVIEW_LIFETIME_MS, previewMemoryId, previewPrefix } from '@/lib/site-builder/stephon-private-artifact';
import type { ExecutiveActionExecutorResult } from './executive-action-executors';

type Db=MySql2Database<typeof schema>;
export async function generateStephonDraft(ctx:{db:Db;adminUserId:number;approvalId:string},raw:unknown):Promise<ExecutiveActionExecutorResult>{
  const input=GenerateStephonDraftSchema.parse(raw);
  // Both relationships must hold before even resolving provider credentials.
  const [client]=await ctx.db.select({id:clients.id}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.userId,ctx.adminUserId))).limit(1);
  const [site]=await ctx.db.select().from(web3Sites).where(and(eq(web3Sites.id,input.siteId),eq(web3Sites.userId,ctx.adminUserId),eq(web3Sites.clientId,input.clientId))).limit(1);
  if(!client||!site||site.status!=='DRAFT')throw Error('An owned, client-linked DRAFT site is required.');
  let selection=selectSiteBuilderLlmInvoke({llmMode:'off',endpoint:null,model:null,apiKeyEnc:null,fallbackToPlatform:false});
  if(input.generationMode==='configured'){
    // Read only: the legacy getter auto-creates a table, which is forbidden here.
    const [rows]=await ctx.db.execute(sql`SELECT llm_mode, endpoint, model, api_key_enc, fallback_to_platform FROM web3_site_builder_ai_settings WHERE site_id=${site.id} AND user_id=${ctx.adminUserId} LIMIT 1`);
    const row=(rows as Array<Record<string,unknown>>)[0];
    selection=selectSiteBuilderLlmInvoke(row?{llmMode:row.llm_mode as 'off'|'platform'|'byok',endpoint:row.endpoint==null?null:String(row.endpoint),model:row.model==null?null:String(row.model),apiKeyEnc:row.api_key_enc==null?null:String(row.api_key_enc),fallbackToPlatform:Boolean(Number(row.fallback_to_platform))}:null);
  }
  const generated=await runFullSiteGeneration({step:'full',input:SitePlannerInputSchema.parse(input.input),siteId:site.id,clientId:client.id,variantCount:1,variantSeed:ctx.approvalId},ctx.adminUserId,
    {invokeLlm:selection.invoke,forceDeterministic:selection.forceDeterministic,llmSource:selection.source},
    {db:ctx.db as Awaited<ReturnType<typeof import('@/lib/db').getDb>>,skipIntelligence:true});
  const document=SiteSchemaDocument.parse(generated.schema);
  const vhash=createHash('sha256').update('stephon-version:'+ctx.approvalId).digest('hex');
  const versionId=`${vhash.slice(0,8)}-${vhash.slice(8,12)}-4${vhash.slice(13,16)}-8${vhash.slice(17,20)}-${vhash.slice(20,32)}`;
  const artifact=preparePrivateBundle(generateStaticBundle(document),versionId);
  const schemaJson=JSON.stringify(document),schemaHash=hashSiteSchema(document);
  assertTextFits(schemaJson);
  const expiresAt=new Date(Date.now()+PREVIEW_LIFETIME_MS);
  const receipt={kind:'stephon_private_draft_v1',approvalId:ctx.approvalId,clientId:client.id,siteId:site.id,versionId,schemaHash,
    previewUrl:previewPrefix(versionId)+'index.html',expiresAt:expiresAt.toISOString(),qualityStatus:'review_required',publication:'not_published',
    generationMode:input.generationMode,providerSource:selection.source,providerCost:input.generationMode==='configured'?'Unmeasured; existing configured provider may charge':'No model invocation requested',
    generationMeta:generated.generationMeta,evaluation:generated.evaluation,files:artifact.files,
    previewLimits:'Inert preview: scripts, external assets, embeds, forms and outgoing links are disabled. Visual and functional review remain required.'};
  const summary=JSON.stringify({...receipt,packed:artifact.packed});assertTextFits(summary);
  const manifest=JSON.stringify(receipt);assertTextFits(manifest);
  // Nested transaction/savepoint: dispatch catches failures, so partial draft writes must roll back independently.
  await ctx.db.transaction(async tx=>{
    const [locked]=await tx.select().from(web3Sites).where(and(eq(web3Sites.id,site.id),eq(web3Sites.userId,ctx.adminUserId),eq(web3Sites.clientId,client.id))).limit(1).for('update');
    const [ownedClient]=await tx.select({id:clients.id}).from(clients).where(and(eq(clients.id,client.id),eq(clients.userId,ctx.adminUserId))).limit(1).for('update');
    if(!locked||!ownedClient||locked.status!=='DRAFT')throw Error('Draft ownership or status changed during generation.');
    const [n]=await tx.select({maxVersion:sql<number>`COALESCE(MAX(${web3SiteVersions.version}),0)`}).from(web3SiteVersions).where(eq(web3SiteVersions.siteId,site.id));
    await tx.insert(web3SiteVersions).values({id:versionId,siteId:site.id,version:Number(n.maxVersion)+1,schemaJson,schemaHash,buildManifestJson:manifest,createdByUserId:ctx.adminUserId});
    await tx.insert(executiveAgentMemoryItems).values({id:previewMemoryId(versionId),adminUserId:ctx.adminUserId,memoryType:'system_note',source:'system',subjectType:'stephon_private_preview',subjectId:versionId,title:'Private Stephon draft artifact',summary,archivedAt:new Date(),expiresAt});
    await tx.insert(clientNotes).values({id:randomUUID(),clientId:client.id,createdByUserId:ctx.adminUserId,visibility:'internal',note:JSON.stringify(receipt)});
    // Never change currentVersionId/status, ipfsCid, or call publication/provider upload code.
  });
  return {ok:true,status:'executed',message:'Private draft version saved. Review is required; no publication or professional-quality certification.',data:receipt};
}
