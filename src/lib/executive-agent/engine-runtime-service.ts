import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { clients, campaigns, executiveAgentAuditLogs } from "@/lib/db/schema";
import { executeExecutiveApprovedAction } from "@/lib/executive-agent/executive-action-executors";
import { getExecutiveApprovalById, insertExecutiveApproval, setExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import { buildExecutiveAgentCoordinationOverviewForAdmin } from "@/lib/executive-agent/executive-agent-coordination-service";
import * as tools from "@/lib/executive-agent/executive-agent-tools";
import { operateEngineWithPorts, EngineRuntimeError } from "./engine-runtime-core";
export { EngineRuntimeError } from "./engine-runtime-core";

type Db = Parameters<typeof getExecutiveApprovalById>[0];
async function ownedInput(db: Db, adminUserId: number, input: Record<string, unknown>) {
  if (typeof input.clientId === "string") {
    const [row] = await db.select({id: clients.id}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.userId,adminUserId))).limit(1);
    if (!row) throw new EngineRuntimeError("Client unavailable to this account.",404);
  }
  if (typeof input.campaignId === "string") {
    const [row] = await db.select({id:campaigns.id}).from(campaigns).where(and(eq(campaigns.id,input.campaignId),eq(campaigns.userId,String(adminUserId)))).limit(1);
    if (!row) throw new EngineRuntimeError("Campaign unavailable to this account.",404);
  }
}
export async function engineReceipt(db: Db, adminUserId: number, requestId: string) {
  const row = await getExecutiveApprovalById(db,requestId,adminUserId);
  if (!row || !row.targetType?.startsWith("engine:")) throw new EngineRuntimeError("Engine job not found.",404);
  const [audit] = await db.select({output:executiveAgentAuditLogs.outputJson}).from(executiveAgentAuditLogs)
    .where(and(eq(executiveAgentAuditLogs.adminUserId,adminUserId),eq(executiveAgentAuditLogs.targetId,requestId),eq(executiveAgentAuditLogs.actionType,"approval_execute")))
    .orderBy(desc(executiveAgentAuditLogs.createdAt)).limit(1);
  let result: unknown = null;
  try { result = audit?.output ? JSON.parse(audit.output) : null; } catch { /* Truncated legacy audit remains unverified. */ }
  return {requestId,engineId:row.targetType.slice(7),status:row.status,input:JSON.parse(row.payloadJson),result,receiptVerified:!!result,
    notice:row.status === "approved" ? "Execution was claimed; a final receipt is not yet confirmed. Do not automatically retry." : "Executor completion is not publication or product quality certification."};
}
export async function operateEngine(db: Db, adminUserId: number, raw: unknown) {
  return operateEngineWithPorts(raw,{
    get: id => getExecutiveApprovalById(db,id,adminUserId),
    owned: input => ownedInput(db,adminUserId,input),
    create: (id,engineId,action,payload,input) => insertExecutiveApproval(db,{id,adminUserId,proposedAction:action,targetType:"engine:"+engineId,targetId:typeof input.clientId === "string" ? input.clientId : typeof input.campaignId === "string" ? input.campaignId:null,payloadJson:JSON.stringify(payload)}),
    claim: async id => (await import("./executive-agent-approvals-store")).claimExecutiveApproval(db,id,adminUserId),
    reject: async id => (await import("./executive-agent-approvals-store")).transitionPendingExecutiveApproval(db,id,adminUserId,"rejected"),
    execute: row => executeExecutiveApprovedAction(db,{adminUserId,approval:row as Parameters<typeof executeExecutiveApprovedAction>[1]["approval"]}),
    finish: (id,ok) => setExecutiveApprovalStatus(db,id,adminUserId,ok?"executed":"failed",{executedAt:new Date()}),
    receipt: id => engineReceipt(db,adminUserId,id),
    read: async (id,input) => {
      const ctx={db,adminUserId};
      switch(id){
        case "company.accounts":return {pending:await tools.getPendingAccounts(ctx),approved:await tools.getApprovedAccounts(ctx)};
        case "company.analytics":return tools.getPlatformAnalyticsSummary(ctx);
        case "agents.overview":return buildExecutiveAgentCoordinationOverviewForAdmin(db,{adminUserId});
        case "bentley.outputs":return tools.getBentleyCampaignOutputs(ctx,{campaignId:typeof input.campaignId === "string"?input.campaignId:undefined});
        case "stephon.projects":return tools.getSiteBuilderProjectStatus(ctx);
        case "eleanor.operations":return tools.getExecutiveFulfillmentOperationsOverview(ctx);
        case "jarva.smart_trust":return tools.getExecutiveSmartTrustFulfillment(ctx);
        case "reality.engagement":return tools.getInboxEngagementSummary(ctx);
        case "skipper.knowledge":return tools.getKnowledgeBaseSummary(ctx);
        default:throw new EngineRuntimeError("No registered read adapter.");
      }
    }
  });
}
