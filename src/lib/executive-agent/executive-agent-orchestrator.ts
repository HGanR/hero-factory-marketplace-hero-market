import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { canInvokeReadTool, defaultExecutiveReadScopes, isWriteAction, type ExecutiveAgentScope } from "@/lib/executive-agent/executive-agent-policy";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import { executeExecutiveApprovedAction } from "@/lib/executive-agent/executive-action-executors";
import { executiveAgentApprovals } from "@/lib/db/schema";
import type { ExecutiveMemorySuggestion } from "@/lib/executive-agent/executive-memory-suggestions";
import { buildSuggestedExecutiveMemoryItems } from "@/lib/executive-agent/executive-memory-suggestions";
import { planExecutiveIntent } from "@/lib/executive-agent/executive-agent-intent-planner";
import { formatExecutiveDeskContext } from "@/lib/executive-agent/executive-orchestrator-context";
import { formatActiveSkipperPromptOverlaysForPlanner } from "@/lib/executive-agent/skipper-learning-prompt-overlays";
import { listActiveSkipperPromptOverlaysForAdmin } from "@/lib/executive-agent/skipper-learning-store";
import * as Tools from "@/lib/executive-agent/executive-agent-tools";
import {
  pendingClientsQueueToolAuditOutput,
  type PendingClientsClaudeHandoffPublic,
} from "@/lib/executive-agent/pending-clients-handoff";

export type ExecutiveOrchestratorMode = "read" | "plan" | "write_request";

export type ExecutiveOrchestratorInput = {
  adminUserId: number;
  prompt: string;
  mode: ExecutiveOrchestratorMode;
  selectedClientId?: string | null;
  selectedCampaignId?: string | null;
  requestedTool?: string | null;
  /** When true, write intents are analyzed but not persisted to approvals (dry run). */
  dryRun?: boolean;
  /** UI agent filter — affects read-tool routing only; does not grant writes. */
  selectedAgents?: string[] | null;
  /** UI time window label — audit / future tool windows only. */
  selectedTimeRange?: string | null;
  /** UI dashboard mode — biases read tools; does not grant writes. */
  dashboardMode?: string | null;
  /** Audit channel: voice turns log separately; policy unchanged. */
  source?: "chat" | "voice";
};

export type ExecutiveOrchestratorResult = {
  answer: string;
  insights: Array<{ title: string; detail: string; data?: Record<string, unknown> }>;
  recommendedActions: Array<{ title: string; description: string; actionKey?: string }>;
  todos: Array<{ title: string; clientId?: string }>;
  charts: Array<{
    title: string;
    type: "bar" | "line" | "sparkline";
    series: Array<{ label: string; value: number }>;
  }>;
  referencedClients: string[];
  referencedAgents: string[];
  requiresApproval: Array<{ id: string; title: string; proposedAction: string }>;
  /** How the intent layer combined deterministic routing with the optional LLM planner. */
  plannerMeta: {
    reasoningMode: "deterministic" | "llm" | "llm_fallback";
    confidence: number;
    proposedApprovalsCount: number;
    /** Voice-only short paths (Executive Administration); never used for write execution. */
    voiceShortCircuit?: "greeting" | "analytics_clarification";
    pendingVoiceIntent?: { intent: "analytics_clarification"; createdAt: string };
  };
  /** Suggested operational memory — never persisted by the orchestrator. */
  suggestedMemoryItems: ExecutiveMemorySuggestion[];
};

function enrichProposedWritePayload(
  action: string,
  payload: Record<string, unknown>,
  selectedClientId: string | null | undefined,
  selectedCampaignId: string | null | undefined,
): Record<string, unknown> {
  const out = { ...payload };
  const cid = selectedClientId?.trim() || "";
  const camp = selectedCampaignId?.trim() || "";
  if (cid && !String(out.clientId ?? "").trim()) {
    if (
      action === "createTodo" ||
      action === "assignFollowUp" ||
      action === "createSpecializedAgent" ||
      action === "updateClientStatus" ||
      action === "createSiteBuilderTask" ||
      action === "createTrustFulfillmentPacket" ||
      action === "triggerBentleyAnalysis"
    ) {
      out.clientId = cid;
    }
  }
  if (camp && !String(out.campaignId ?? "").trim()) {
    if (action === "triggerCampaignSync" || action === "triggerBentleyAnalysis") {
      out.campaignId = camp;
    }
  }
  return out;
}

async function runReadTool(
  name: keyof typeof Tools,
  ctx: Tools.ExecutiveToolContext,
  granted: Set<ExecutiveAgentScope>,
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  prompt: string
): Promise<{ name: string; data: unknown } | null> {
  if (!canInvokeReadTool(name, granted)) return null;
  const auditId = randomUUID();
  const inputJson = JSON.stringify({ selectedClientId: ctx.selectedClientId, selectedCampaignId: ctx.selectedCampaignId });
  try {
    let data: unknown;
    switch (name) {
      case "getPendingAccounts":
        data = await Tools.getPendingAccounts(ctx);
        break;
      case "getPendingClientsQueue":
        data = await Tools.getPendingClientsQueue(ctx);
        break;
      case "getApprovedAccounts":
        data = await Tools.getApprovedAccounts(ctx);
        break;
      case "getActiveAccounts":
        data = await Tools.getActiveAccounts(ctx);
        break;
      case "getClientSummary":
        data = await Tools.getClientSummary(ctx);
        break;
      case "getClientTodos":
        data = await Tools.getClientTodos(ctx);
        break;
      case "getAgentConversationSummary":
        data = await Tools.getAgentConversationSummary(ctx);
        break;
      case "getBentleyCampaignOutputs":
        data = await Tools.getBentleyCampaignOutputs(ctx);
        break;
      case "getBentleyExecutiveBridgeSummary":
        data = await Tools.getBentleyExecutiveBridgeSummary(ctx);
        break;
      case "getAiRevenueOsStatus":
        data = await Tools.getAiRevenueOsStatus(ctx);
        break;
      case "getSiteBuilderProjectStatus":
        data = await Tools.getSiteBuilderProjectStatus(ctx);
        break;
      case "getPlatformAnalyticsSummary":
        data = await Tools.getPlatformAnalyticsSummary(ctx);
        break;
      case "getInboxEngagementSummary":
        data = await Tools.getInboxEngagementSummary(ctx);
        break;
      case "getKnowledgeBaseSummary":
        data = await Tools.getKnowledgeBaseSummary(ctx);
        break;
      case "getClientFulfillmentOperations":
        data = await Tools.getClientFulfillmentOperations(ctx);
        break;
      case "getExecutiveFulfillmentOperationsOverview":
        data = await Tools.getExecutiveFulfillmentOperationsOverview(ctx);
        break;
      case "getExecutiveFulfillmentOperationsBriefing":
        data = await Tools.getExecutiveFulfillmentOperationsBriefing(ctx);
        break;
      default:
        return null;
    }
    const outputJson =
      name === "getPendingClientsQueue"
        ? pendingClientsQueueToolAuditOutput(
            (data as { claudeHandoff: PendingClientsClaudeHandoffPublic }).claudeHandoff,
          )
        : JSON.stringify(data).slice(0, 50_000);
    await insertExecutiveAgentAuditLog(db, {
      id: auditId,
      adminUserId,
      prompt,
      toolName: name,
      actionType: "read_tool",
      targetType: "platform",
      inputJson,
      outputJson,
      approvalStatus: "not_required",
    });
    return { name, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await insertExecutiveAgentAuditLog(db, {
      id: auditId,
      adminUserId,
      prompt,
      toolName: name,
      actionType: "read_tool_error",
      inputJson,
      outputJson: JSON.stringify({ error: msg }).slice(0, 50_000),
      approvalStatus: "not_required",
    });
    return { name, data: { error: msg } };
  }
}

export async function runExecutiveOrchestrator(
  db: MySql2Database<typeof schema>,
  input: ExecutiveOrchestratorInput
): Promise<ExecutiveOrchestratorResult> {
  const granted = new Set<ExecutiveAgentScope>(defaultExecutiveReadScopes());
  const ctx: Tools.ExecutiveToolContext = {
    db,
    adminUserId: input.adminUserId,
    selectedClientId: input.selectedClientId?.trim() || null,
    selectedCampaignId: input.selectedCampaignId?.trim() || null,
  };

  const turnAuditId = randomUUID();
  await insertExecutiveAgentAuditLog(db, {
    id: turnAuditId,
    adminUserId: input.adminUserId,
    prompt: input.prompt,
    toolName: "orchestrator.turn",
    actionType: "chat",
    inputJson: JSON.stringify({
      mode: input.mode,
      requestedTool: input.requestedTool ?? null,
      dryRun: Boolean(input.dryRun),
      selectedAgents: input.selectedAgents ?? null,
      selectedTimeRange: input.selectedTimeRange ?? null,
      dashboardMode: input.dashboardMode ?? null,
      source: input.source ?? "chat",
    }),
    outputJson: null,
    approvalStatus: "not_required",
  });

  const insights: ExecutiveOrchestratorResult["insights"] = [];
  const charts: ExecutiveOrchestratorResult["charts"] = [];
  const recommendedActions: ExecutiveOrchestratorResult["recommendedActions"] = [];
  const todos: ExecutiveOrchestratorResult["todos"] = [];
  const requiresApproval: ExecutiveOrchestratorResult["requiresApproval"] = [];
  const referencedClients: string[] = [];
  const referencedAgents: string[] = [];

  if (input.selectedClientId?.trim()) referencedClients.push(input.selectedClientId.trim());
  for (const a of input.selectedAgents ?? []) {
    const t = String(a).trim();
    if (t) referencedAgents.push(t);
  }

  const deskContext = await formatExecutiveDeskContext(db, {
    adminUserId: input.adminUserId,
    prompt: input.prompt,
    selectedAgents: input.selectedAgents ?? null,
    dashboardMode: input.dashboardMode ?? null,
    selectedTimeRange: input.selectedTimeRange ?? null,
  });
  const basePrompt = deskContext ? `${input.prompt}\n\n--- Executive desk context (read-only) ---\n${deskContext}` : input.prompt;

  const overlayRows = await listActiveSkipperPromptOverlaysForAdmin(db, input.adminUserId, 24);
  const overlayBlock = formatActiveSkipperPromptOverlaysForPlanner(
    overlayRows.map((r) => ({ title: r.title, content: r.content })),
  );
  const promptForIntent = overlayBlock.trim() ? `${basePrompt}\n\n${overlayBlock}` : basePrompt;

  const { plan: intentPlan, reasoningMode } = await planExecutiveIntent({
    prompt: promptForIntent,
    requestedTool: input.requestedTool,
    dashboardMode: input.dashboardMode ?? null,
    selectedAgents: input.selectedAgents ?? null,
    selectedTimeRange: input.selectedTimeRange ?? null,
    selectedClientId: input.selectedClientId ?? null,
    selectedCampaignId: input.selectedCampaignId ?? null,
    granted,
  });

  const readNames = intentPlan.readTools;
  for (const toolName of readNames) {
    const r = await runReadTool(toolName as keyof typeof Tools, ctx, granted, db, input.adminUserId, input.prompt);
    if (!r) continue;
    if (r.name === "getPendingClientsQueue") {
      const handoff = (r.data as { claudeHandoff: PendingClientsClaudeHandoffPublic }).claudeHandoff;
      insights.push({
        title: r.name,
        detail: handoff.summaryLine,
        data: handoff as unknown as Record<string, unknown>,
      });
    } else {
      insights.push({
        title: r.name,
        detail: typeof r.data === "object" && r.data && "message" in (r.data as object)
          ? String((r.data as { message?: string }).message ?? JSON.stringify(r.data).slice(0, 400))
          : JSON.stringify(r.data).slice(0, 400),
        data: typeof r.data === "object" && r.data ? (r.data as Record<string, unknown>) : undefined,
      });
    }
  }

  const pending = insights.find((i) => i.title === "getPendingAccounts")?.data as
    | { pendingAllTime?: number }
    | undefined;
  const approved = insights.find((i) => i.title === "getApprovedAccounts")?.data as
    | { approvedActive?: number }
    | undefined;
  if (pending || approved) {
    charts.push({
      title: "Accounts overview",
      type: "bar",
      series: [
        { label: "Pending (all time)", value: Number(pending?.pendingAllTime ?? 0) },
        { label: "Approved active", value: Number(approved?.approvedActive ?? 0) },
      ],
    });
  }

  const proposedWrites = intentPlan.proposedActions.filter((w) => isWriteAction(w.action));
  let dryRunWriteDetected = false;
  for (const w of proposedWrites) {
    const payload = enrichProposedWritePayload(
      w.action,
      w.payload,
      input.selectedClientId,
      input.selectedCampaignId,
    );
    const approvalId = randomUUID();
    const title = w.title?.trim() || `Approve: ${w.action}`;
    if (!input.dryRun) {
      await insertExecutiveApproval(db, {
        id: approvalId,
        adminUserId: input.adminUserId,
        proposedAction: w.action,
        targetType: "platform",
        targetId: input.selectedClientId?.trim() || null,
        payloadJson: JSON.stringify(payload).slice(0, 100_000),
      });
      await insertExecutiveAgentAuditLog(db, {
        id: randomUUID(),
        adminUserId: input.adminUserId,
        prompt: input.prompt,
        toolName: w.action,
        actionType: "write_proposal",
        targetType: "approval_queue",
        targetId: approvalId,
        inputJson: JSON.stringify(payload).slice(0, 50_000),
        outputJson: null,
        approvalStatus: "pending",
      });
      requiresApproval.push({ id: approvalId, title, proposedAction: w.action });
    } else {
      dryRunWriteDetected = true;
    }
    recommendedActions.push({
      title,
      description: "Write actions require explicit approval before any executor runs.",
      actionKey: w.action,
    });
  }

  const answerParts: string[] = [];
  if (intentPlan.reasoningSummary.trim()) {
    answerParts.push(intentPlan.reasoningSummary.trim());
  }
  answerParts.push("Executive summary (read-only tools).");
  if (insights.length) {
    answerParts.push(`Collected ${insights.length} insight blocks from the tool registry.`);
  }
  if (requiresApproval.length) {
    answerParts.push(`${requiresApproval.length} proposal(s) queued for your approval.`);
  } else if (dryRunWriteDetected) {
    answerParts.push("Dry run: write proposal(s) were detected but not queued.");
  }

  const proposedApprovalsCount = input.dryRun ? proposedWrites.length : requiresApproval.length;

  const suggestedMemoryItems = buildSuggestedExecutiveMemoryItems({
    prompt: input.prompt,
    channel: input.source ?? "chat",
    selectedClientId: input.selectedClientId ?? null,
    reasoningSummary: intentPlan.reasoningSummary,
    queuedApprovalTitles: requiresApproval.map((x) => x.title),
    proposedWriteActions: proposedWrites.map((w) => w.action),
  });

  return {
    answer: answerParts.join(" "),
    insights,
    recommendedActions,
    todos,
    charts,
    referencedClients: [...new Set(referencedClients)],
    referencedAgents: [...new Set(referencedAgents)],
    requiresApproval,
    plannerMeta: {
      reasoningMode,
      confidence: intentPlan.confidence,
      proposedApprovalsCount,
    },
    suggestedMemoryItems,
  };
}

export async function executeApprovedTodoFromPayload(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
  const approval: typeof executiveAgentApprovals.$inferSelect = {
    id: "legacy-inline",
    adminUserId,
    proposedAction: "createTodo",
    targetType: "client",
    targetId: typeof payload.clientId === "string" ? payload.clientId.trim() || null : null,
    payloadJson: JSON.stringify(payload).slice(0, 100_000),
    status: "approved",
    createdAt: new Date(),
    executedAt: null,
  };
  const r = await executeExecutiveApprovedAction(db, { adminUserId, approval });
  return { ok: r.ok, message: r.message };
}
