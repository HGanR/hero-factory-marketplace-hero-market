import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { clients, campaigns, executiveAgentAuditLogs } from "@/lib/db/schema";
import { getExecutiveApprovalById, insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import { buildExecutiveAgentCoordinationOverviewForAdmin } from "@/lib/executive-agent/executive-agent-coordination-service";
import * as tools from "@/lib/executive-agent/executive-agent-tools";
import { listDepartmentMessagesForExecutiveAdmin, listApprovedMarketplaceUsers } from "@/lib/executive-agent/executive-department-inbox-store";
import type { EnginePorts } from "./engine-runtime-core";
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
  return {requestId,engineId:row.targetType.slice(7),status:row.status,input:JSON.parse(row.payloadJson),result,receiptVerified:result !== null,
    notice:row.status === "approved" ? "Execution was claimed; a final receipt is not yet confirmed. Do not automatically retry." : "Executor completion is not publication or product quality certification."};
}
export async function operateEngine(db: Db, adminUserId: number, raw: unknown, decide: EnginePorts["decide"]) {
  return operateEngineWithPorts(raw,{
    get: id => getExecutiveApprovalById(db,id,adminUserId),
    owned: input => ownedInput(db,adminUserId,input),
    create: (id,engineId,action,payload,input) => insertExecutiveApproval(db,{id,adminUserId,proposedAction:action,targetType:"engine:"+engineId,targetId:typeof input.clientId === "string" ? input.clientId : typeof input.campaignId === "string" ? input.campaignId:null,payloadJson:JSON.stringify(payload)}),
    decide,
    receipt: id => engineReceipt(db,adminUserId,id),
    read: async (id,input) => {
      const ctx={db,adminUserId};
      switch(id){
        case "executive.inbox": {
          const [messages, recipients] = await Promise.all([listDepartmentMessagesForExecutiveAdmin(db, 120), listApprovedMarketplaceUsers(db, 2500)]);
          return {messages, recipients, limits: {messages: 120, recipients: 2500}, notice: "Executive Inbox records only; no outbound send or external email access."};
        }
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

