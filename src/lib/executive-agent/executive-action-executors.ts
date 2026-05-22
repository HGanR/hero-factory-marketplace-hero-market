import "server-only";

import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { aiAgents, campaigns, clients, clientNotes, executiveAgentApprovals } from "@/lib/db/schema";
import { buildSpecializedAgentSpec } from "@/lib/executive-agent/agent-factory";
import {
  AssignFollowUpPayloadSchema,
  assertSafeExecutiveCampaignSyncInput,
  CreateSiteBuilderTaskPayloadSchema,
  CreateRevenueOsCampaignReviewPacketPayloadSchema,
  CreateSmartTrustGovernanceReviewPacketPayloadSchema,
  CreateTrustFulfillmentPacketPayloadSchema,
  CreateSpecializedAgentPayloadSchema,
  CreateTodoPayloadSchema,
  RecordRevenueOsLaunchReadinessPayloadSchema,
  RecordSmartTrustResolutionCheckpointPayloadSchema,
  DelegateOperationalTaskPayloadSchema,
  EscalateOperationalTaskPayloadSchema,
  TriggerBentleyAnalysisPayloadSchema,
  TriggerCampaignSyncPayloadSchema,
} from "@/lib/executive-agent/executive-action-payloads";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { isWriteAction, type ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";
import { linkSiteBuilderDraftToFulfillmentDeliverable } from "@/lib/fulfillment/fulfillment-deliverable-draft";
import { linkTrustPacketToFulfillmentDeliverable } from "@/lib/fulfillment/fulfillment-trust-deliverable-draft";
import {
  linkRevenueOsCampaignReviewToFulfillmentDeliverable,
  recordRevenueOsLaunchReadinessOnOrder,
} from "@/lib/fulfillment/revenue-os-fulfillment-deliverable";
import {
  linkSmartTrustGovernanceReviewToFulfillmentDeliverable,
  recordSmartTrustGovernanceReviewOnOrder,
  recordSmartTrustResolutionOnOrder,
} from "@/lib/fulfillment/smart-trust-fulfillment-deliverable";
import {
  applyApprovedTaskDelegation,
  applyApprovedTaskEscalation,
} from "@/lib/executive-agent/delegated-task-coordination";
import { isExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-registry";
import { SMART_TRUST_GOVERNANCE_DISCLAIMER } from "@/lib/fulfillment/smart-trust-governance-workflow";
import {
  REVENUE_OS_CAMPAIGN_REVIEW_NOTE_MARKER,
  REVENUE_OS_FULFILLMENT_DISCLAIMER,
  REVENUE_OS_FULFILLMENT_NOTE_FOOTER,
  REVENUE_OS_LAUNCH_READINESS_NOTE_MARKER,
} from "@/lib/fulfillment/revenue-os-campaign-review";
import {
  TRUST_FULFILLMENT_LEGAL_DISCLAIMER,
  TRUST_FULFILLMENT_NOTE_FOOTER,
  TRUST_REVIEW_PACKET_NOTE_MARKER,
  TRUST_SETUP_BRIEF_NOTE_MARKER,
} from "@/lib/fulfillment/fulfillment-trust-legal";
import { FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF } from "@/lib/fulfillment/fulfillment-types";
import { runMarketIntelligenceSweepPipeline } from "@/lib/revenue-os/market-sweep-pipeline";
import { syncBentleyCampaignPostsAndSchedule, type SyncBentleyLaunchInput } from "@/lib/revenue-os/bentley-sync-launch-server";

type Db = MySql2Database<typeof schema>;
export type ExecutiveApprovalRow = typeof executiveAgentApprovals.$inferSelect;

export type ExecutiveActionExecutorResult = {
  ok: boolean;
  status: "executed" | "failed" | "not_configured";
  message: string;
  /** Sanitized, small — never API keys or raw secrets. */
  data?: Record<string, unknown>;
};

type ExecCtx = {
  db: Db;
  adminUserId: number;
  approvalId: string;
};

const SECRET_KEY_RE = /(apikey|api_key|secret|password|token|authorization)/i;

function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_RE.test(k)) continue;
    if (typeof v === "string" && v.length > 800) out[k] = `${v.slice(0, 800)}…`;
    else if (v != null && typeof v === "object" && !Array.isArray(v)) out[k] = sanitizeForAudit(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

async function auditExecutor(
  db: Db,
  input: {
    adminUserId: number;
    approvalId: string;
    proposedAction: string;
    targetType: string | null;
    targetId: string | null;
    payloadJson: string;
    result: ExecutiveActionExecutorResult;
  }
): Promise<void> {
  const outJson = JSON.stringify({
    ok: input.result.ok,
    status: input.result.status,
    message: input.result.message,
    data: input.result.data ? sanitizeForAudit(input.result.data as Record<string, unknown>) : undefined,
  }).slice(0, 50_000);
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: `executor.${input.proposedAction}`,
    actionType: "approval_execute",
    targetType: input.targetType ?? "approval_queue",
    targetId: input.approvalId,
    inputJson: input.payloadJson.slice(0, 50_000),
    outputJson: outJson,
    approvalStatus: input.result.ok ? "executed" : "failed",
  });
}

async function assertClientOwnedByAdmin(
  db: Db,
  clientId: string,
  adminUserId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, adminUserId)))
    .limit(1);
  if (!row) return { ok: false, message: "Client not found or not owned by this admin user." };
  return { ok: true };
}

async function assertCampaignOwnedByAdmin(
  db: Db,
  campaignId: string,
  adminUserId: number
): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const uid = String(adminUserId);
  const [row] = await db
    .select({ id: campaigns.id, userId: campaigns.userId })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, uid)))
    .limit(1);
  if (!row) return { ok: false, message: "Campaign not found or not owned by this admin user." };
  return { ok: true, userId: row.userId };
}

export {
  AssignFollowUpPayloadSchema,
  assertSafeExecutiveCampaignSyncInput,
  CreateSiteBuilderTaskPayloadSchema,
  CreateSpecializedAgentPayloadSchema,
  CreateTodoPayloadSchema,
  TriggerBentleyAnalysisPayloadSchema,
  TriggerCampaignSyncPayloadSchema,
} from "@/lib/executive-agent/executive-action-payloads";

async function runCreateTodo(ctx: ExecCtx, raw: unknown): Promise<ExecutiveActionExecutorResult> {
  const parsed = CreateTodoPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: "failed", message: "Invalid createTodo payload.", data: { issues: parsed.error.flatten() } };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };
  await ctx.db.insert(clientNotes).values({
    id: randomUUID(),
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `[Executive Agent — approved todo]\n${parsed.data.note}`,
  });
  return { ok: true, status: "executed", message: "Internal client note recorded.", data: { clientId: parsed.data.clientId } };
}

async function runAssignFollowUp(ctx: ExecCtx, raw: unknown): Promise<ExecutiveActionExecutorResult> {
  const parsed = AssignFollowUpPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: "failed", message: "Invalid assignFollowUp payload.", data: { issues: parsed.error.flatten() } };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };
  const header = `[Executive Agent — follow-up task]\nTitle: ${parsed.data.title}\nPriority: ${parsed.data.priority}`;
  const due = parsed.data.dueAt ? `\nDue: ${parsed.data.dueAt}` : "";
  const body = parsed.data.description ? `\n\n${parsed.data.description}` : "";
  await ctx.db.insert(clientNotes).values({
    id: randomUUID(),
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `${header}${due}${body}`,
  });
  return { ok: true, status: "executed", message: "Follow-up recorded as internal client note.", data: { clientId: parsed.data.clientId } };
}

async function runCreateSpecializedAgent(ctx: ExecCtx, raw: unknown): Promise<ExecutiveActionExecutorResult> {
  const parsed = CreateSpecializedAgentPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid createSpecializedAgent payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  let spec;
  try {
    spec = buildSpecializedAgentSpec({
      templateKey: parsed.data.templateKey,
      clientId: parsed.data.clientId?.trim() || null,
      workspaceId: parsed.data.workspaceId?.trim() || null,
    });
  } catch (e) {
    return { ok: false, status: "failed", message: e instanceof Error ? e.message : "Spec build failed." };
  }
  if (parsed.data.clientId?.trim()) {
    const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId.trim(), ctx.adminUserId);
    if (!own.ok) return { ok: false, status: "failed", message: own.message };
  }
  const id = randomUUID();
  const name = `Executive specialized — ${parsed.data.templateKey}`.slice(0, 120);
  const desc = spec.purpose.slice(0, 255);
  try {
    await ctx.db.insert(aiAgents).values({
      id,
      userId: ctx.adminUserId,
      workspaceId: spec.clientWorkspaceScope.workspaceId ?? undefined,
      name,
      description: desc,
      systemPrompt: `Template: ${spec.templateKey}\nPurpose: ${spec.purpose}`,
      toolsJson: JSON.stringify({
        permissions: spec.permissions,
        knowledgeSources: spec.knowledgeSources,
        executiveTemplate: spec.templateKey,
      }),
      status: "draft",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const missing = /Unknown table|doesn't exist|no such table/i.test(msg);
    return {
      ok: false,
      status: "not_configured",
      message: missing
        ? "AI agent persistence table is not available in this environment."
        : `Could not persist specialized agent: ${msg.slice(0, 240)}`,
    };
  }
  return {
    ok: true,
    status: "executed",
    message: "Specialized agent draft row created.",
    data: { agentId: id, templateKey: parsed.data.templateKey },
  };
}

async function runTriggerBentleyAnalysis(ctx: ExecCtx, raw: unknown): Promise<ExecutiveActionExecutorResult> {
  const parsed = TriggerBentleyAnalysisPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid triggerBentleyAnalysis payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  const { mode, campaignId, clientId, industry, targetAudience } = parsed.data;

  if (mode === "full_lifecycle") {
    return {
      ok: false,
      status: "failed",
      message:
        "full_lifecycle is not runnable from a single approved action — it can include launch/publish phases. Use analysis or market_sweep, or queue separate approvals.",
    };
  }

  if (mode === "analysis") {
    const cid = campaignId!.trim();
    const camp = await assertCampaignOwnedByAdmin(ctx.db, cid, ctx.adminUserId);
    if (!camp.ok) return { ok: false, status: "failed", message: camp.message };
    const [row] = await ctx.db.select().from(campaigns).where(eq(campaigns.id, cid)).limit(1);
    const hasPayload = Boolean(row?.bentleyGenerationJson);
    return {
      ok: true,
      status: "executed",
      message: "Read-only analysis snapshot — no publish or schedule.",
      data: {
        campaignId: cid,
        hasBentleyGenerationJson: hasPayload,
        campaignStatus: row?.status ?? null,
      },
    };
  }

  if (mode === "market_sweep") {
    const ind = industry!.trim();
    const ta = (targetAudience ?? "general audience").trim() || "general audience";
    const cid = clientId!.trim();
    const own = await assertClientOwnedByAdmin(ctx.db, cid, ctx.adminUserId);
    if (!own.ok) return { ok: false, status: "failed", message: own.message };
    try {
      const { result } = await runMarketIntelligenceSweepPipeline({
        industry: ind,
        targetAudience: ta,
        platforms: ["reddit"],
        clientId: cid,
        trustId: "",
        userId: String(ctx.adminUserId),
      });
      return {
        ok: true,
        status: "executed",
        message: "Market intelligence sweep completed (no social publish).",
        data: {
          bucketCounts: {
            trending: result.trendingTopics?.length ?? 0,
            hooks: result.viralHooks?.length ?? 0,
            painPoints: result.painPoints?.length ?? 0,
          },
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, status: "failed", message: msg.slice(0, 500) };
    }
  }

  return { ok: false, status: "failed", message: "Unsupported analysis mode." };
}

async function runTriggerCampaignSync(ctx: ExecCtx, raw: unknown): Promise<ExecutiveActionExecutorResult> {
  const parsed = TriggerCampaignSyncPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid triggerCampaignSync payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  const camp = await assertCampaignOwnedByAdmin(ctx.db, parsed.data.campaignId, ctx.adminUserId);
  if (!camp.ok) return { ok: false, status: "failed", message: camp.message };

  if (parsed.data.dryRun) {
    const [row] = await ctx.db.select().from(campaigns).where(eq(campaigns.id, parsed.data.campaignId)).limit(1);
    return {
      ok: true,
      status: "executed",
      message: "Dry run — no posts created or updated.",
      data: {
        dryRun: true,
        campaignId: parsed.data.campaignId,
        hasBentleyPayload: Boolean(row?.bentleyGenerationJson),
      },
    };
  }

  const input: SyncBentleyLaunchInput = {
    userId: camp.userId,
    campaignId: parsed.data.campaignId,
    scheduleStrategy: "immediate",
    postCreationMode: "draft_unscheduled",
    content360PlatformSchedule: false,
    requireApprovalOverride: true,
  };
  assertSafeExecutiveCampaignSyncInput(input);
  try {
    const r = await syncBentleyCampaignPostsAndSchedule(ctx.db, input);
    return {
      ok: true,
      status: "executed",
      message: "Campaign posts synced as drafts only (no schedule/publish in this executor).",
      data: {
        created: r.created,
        skipped: r.skipped,
        rescheduled: r.rescheduled,
        postIds: r.postIds.slice(0, 20),
        requireApproval: r.requireApproval,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: "failed", message: msg.slice(0, 500) };
  }
}

async function runCreateRevenueOsCampaignReviewPacket(
  ctx: ExecCtx,
  raw: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = CreateRevenueOsCampaignReviewPacketPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid createRevenueOsCampaignReviewPacket payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (parsed.data.primaryService !== "REVENUE_OS") {
    return {
      ok: false,
      status: "failed",
      message: "createRevenueOsCampaignReviewPacket requires primaryService REVENUE_OS.",
    };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };

  const clientNoteId = randomUUID();
  await ctx.db.insert(clientNotes).values({
    id: clientNoteId,
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `${REVENUE_OS_CAMPAIGN_REVIEW_NOTE_MARKER}
Title: ${parsed.data.title}
Campaign: ${parsed.data.campaignId}
Priority: ${parsed.data.priority}

${REVENUE_OS_FULFILLMENT_DISCLAIMER}

${parsed.data.packetMarkdown}

${REVENUE_OS_FULFILLMENT_NOTE_FOOTER}`,
  });

  return {
    ok: true,
    status: "executed",
    message:
      "Campaign review packet captured as internal note. No publish, launch, ad spend, or Content360 execution.",
    data: {
      clientId: parsed.data.clientId,
      clientNoteId,
      fulfillmentOrderId: parsed.data.fulfillmentOrderId,
      campaignId: parsed.data.campaignId,
    },
  };
}

async function runRecordRevenueOsLaunchReadinessCheckpoint(
  ctx: ExecCtx,
  raw: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = RecordRevenueOsLaunchReadinessPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid recordRevenueOsLaunchReadinessCheckpoint payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (parsed.data.primaryService !== "REVENUE_OS") {
    return {
      ok: false,
      status: "failed",
      message: "recordRevenueOsLaunchReadinessCheckpoint requires primaryService REVENUE_OS.",
    };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };

  const clientNoteId = randomUUID();
  await ctx.db.insert(clientNotes).values({
    id: clientNoteId,
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `${REVENUE_OS_LAUNCH_READINESS_NOTE_MARKER}
Campaign: ${parsed.data.campaignId}
Order: ${parsed.data.fulfillmentOrderId}

${REVENUE_OS_FULFILLMENT_DISCLAIMER}

${parsed.data.readinessSummary}

Owner attestation:
${parsed.data.ownerAttestation}

${REVENUE_OS_FULFILLMENT_NOTE_FOOTER}`,
  });

  await recordRevenueOsLaunchReadinessOnOrder(ctx.db, {
    adminUserId: ctx.adminUserId,
    approvalId: ctx.approvalId,
    payload: parsed.data,
  });

  return {
    ok: true,
    status: "executed",
    message:
      "Launch readiness checkpoint recorded. Does not run sync-launch, schedule posts, or spend ad budget.",
    data: {
      clientId: parsed.data.clientId,
      clientNoteId,
      fulfillmentOrderId: parsed.data.fulfillmentOrderId,
      campaignId: parsed.data.campaignId,
    },
  };
}

export const SMART_TRUST_GOVERNANCE_REVIEW_NOTE_MARKER = "[Smart Trust — governance review packet]";
export const SMART_TRUST_RESOLUTION_NOTE_MARKER = "[Smart Trust — resolution / minutes record]";

const SMART_TRUST_FULFILLMENT_NOTE_FOOTER =
  "---\nInternal executive note. Not client-facing. No trust execution, filing, or signatures.";

async function runCreateSmartTrustGovernanceReviewPacket(
  ctx: ExecCtx,
  raw: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = CreateSmartTrustGovernanceReviewPacketPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid createSmartTrustGovernanceReviewPacket payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (parsed.data.primaryService !== "SMART_TRUST") {
    return {
      ok: false,
      status: "failed",
      message: "createSmartTrustGovernanceReviewPacket requires primaryService SMART_TRUST.",
    };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };

  const clientNoteId = randomUUID();
  await ctx.db.insert(clientNotes).values({
    id: clientNoteId,
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `${SMART_TRUST_GOVERNANCE_REVIEW_NOTE_MARKER}
Title: ${parsed.data.title}
Trust: ${parsed.data.trustId}
Round: ${parsed.data.governanceReviewRound}

${SMART_TRUST_GOVERNANCE_DISCLAIMER}

${parsed.data.packetMarkdown}

${SMART_TRUST_FULFILLMENT_NOTE_FOOTER}`,
  });

  await recordSmartTrustGovernanceReviewOnOrder(ctx.db, {
    adminUserId: ctx.adminUserId,
    approvalId: ctx.approvalId,
    payload: parsed.data,
  });

  return {
    ok: true,
    status: "executed",
    message:
      "Governance review packet captured as internal note. No trust execution or amendment application.",
    data: {
      clientId: parsed.data.clientId,
      clientNoteId,
      fulfillmentOrderId: parsed.data.fulfillmentOrderId,
      trustId: parsed.data.trustId,
    },
  };
}

async function runRecordSmartTrustResolutionCheckpoint(
  ctx: ExecCtx,
  raw: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = RecordSmartTrustResolutionCheckpointPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid recordSmartTrustResolutionCheckpoint payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (parsed.data.primaryService !== "SMART_TRUST") {
    return {
      ok: false,
      status: "failed",
      message: "recordSmartTrustResolutionCheckpoint requires primaryService SMART_TRUST.",
    };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };

  const clientNoteId = randomUUID();
  await ctx.db.insert(clientNotes).values({
    id: clientNoteId,
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `${SMART_TRUST_RESOLUTION_NOTE_MARKER}
Resolution: ${parsed.data.resolutionTitle}
Trust: ${parsed.data.trustId}
Order: ${parsed.data.fulfillmentOrderId}

${SMART_TRUST_GOVERNANCE_DISCLAIMER}

${parsed.data.recordMarkdown}

${SMART_TRUST_FULFILLMENT_NOTE_FOOTER}`,
  });

  await recordSmartTrustResolutionOnOrder(ctx.db, {
    adminUserId: ctx.adminUserId,
    approvalId: ctx.approvalId,
    payload: parsed.data,
  });

  return {
    ok: true,
    status: "executed",
    message:
      "Resolution/minutes record captured. Does not file, sign, or apply trust amendments.",
    data: {
      clientId: parsed.data.clientId,
      clientNoteId,
      fulfillmentOrderId: parsed.data.fulfillmentOrderId,
      resolutionId: parsed.data.resolutionId,
    },
  };
}

async function runCreateTrustFulfillmentPacket(
  ctx: ExecCtx,
  raw: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = CreateTrustFulfillmentPacketPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid createTrustFulfillmentPacket payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (parsed.data.primaryService !== "TRUST") {
    return {
      ok: false,
      status: "failed",
      message: "createTrustFulfillmentPacket requires primaryService TRUST.",
    };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };

  const marker =
    parsed.data.deliverableType === FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF
      ? TRUST_SETUP_BRIEF_NOTE_MARKER
      : TRUST_REVIEW_PACKET_NOTE_MARKER;

  const clientNoteId = randomUUID();
  await ctx.db.insert(clientNotes).values({
    id: clientNoteId,
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `${marker}
Title: ${parsed.data.title}
Priority: ${parsed.data.priority}
Packet type: ${parsed.data.deliverableType}

${TRUST_FULFILLMENT_LEGAL_DISCLAIMER}

${parsed.data.packetMarkdown}

${TRUST_FULFILLMENT_NOTE_FOOTER}`,
  });

  return {
    ok: true,
    status: "executed",
    message:
      "Trust fulfillment packet captured as internal legal-review note. No trust apply, execution, or client delivery.",
    data: {
      clientId: parsed.data.clientId,
      clientNoteId,
      fulfillmentOrderId: parsed.data.fulfillmentOrderId,
    },
  };
}

async function runCreateSiteBuilderTask(ctx: ExecCtx, raw: unknown): Promise<ExecutiveActionExecutorResult> {
  const parsed = CreateSiteBuilderTaskPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid createSiteBuilderTask payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  const own = await assertClientOwnedByAdmin(ctx.db, parsed.data.clientId, ctx.adminUserId);
  if (!own.ok) return { ok: false, status: "failed", message: own.message };
  const slug = parsed.data.pageSlug?.trim() ? `\nPage slug: ${parsed.data.pageSlug.trim()}` : "";
  const clientNoteId = randomUUID();
  await ctx.db.insert(clientNotes).values({
    id: clientNoteId,
    clientId: parsed.data.clientId,
    createdByUserId: ctx.adminUserId,
    visibility: "internal",
    note: `[Site Builder — approved task]\nTitle: ${parsed.data.title}\nPriority: ${parsed.data.priority}${slug}\n\n${parsed.data.instruction}\n\n(No live site schema mutation from this action.)`,
  });
  return {
    ok: true,
    status: "executed",
    message: "Site Builder task captured as internal note (intake only).",
    data: { clientId: parsed.data.clientId, clientNoteId },
  };
}

async function runDelegateOperationalTask(
  ctx: ExecCtx,
  payload: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = DelegateOperationalTaskPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid delegateOperationalTask payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (!isExecutiveOperatorId(parsed.data.targetOperatorId)) {
    return { ok: false, status: "failed", message: "Invalid target operator id." };
  }
  await applyApprovedTaskDelegation(ctx.db, {
    adminUserId: ctx.adminUserId,
    approvalId: ctx.approvalId,
    taskId: parsed.data.taskId,
    payload: {
      taskId: parsed.data.taskId,
      targetOperatorId: parsed.data.targetOperatorId,
      rationale: parsed.data.rationale,
    },
  });
  return {
    ok: true,
    status: "executed",
    message:
      "Delegation recorded — target operator must accept; no autonomous delegation acceptance or reassignment.",
    data: { taskId: parsed.data.taskId, targetOperatorId: parsed.data.targetOperatorId },
  };
}

async function runEscalateOperationalTask(
  ctx: ExecCtx,
  payload: unknown
): Promise<ExecutiveActionExecutorResult> {
  const parsed = EscalateOperationalTaskPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: "failed",
      message: "Invalid escalateOperationalTask payload.",
      data: { issues: parsed.error.flatten() },
    };
  }
  if (!isExecutiveOperatorId(parsed.data.targetOperatorId)) {
    return { ok: false, status: "failed", message: "Invalid escalation target operator id." };
  }
  await applyApprovedTaskEscalation(ctx.db, {
    adminUserId: ctx.adminUserId,
    approvalId: ctx.approvalId,
    taskId: parsed.data.taskId,
    payload: {
      taskId: parsed.data.taskId,
      targetOperatorId: parsed.data.targetOperatorId,
      rationale: parsed.data.rationale,
      priority: parsed.data.priority,
    },
  });
  return {
    ok: true,
    status: "executed",
    message: "Escalation recorded on task — no autonomous escalation execution.",
    data: { taskId: parsed.data.taskId, targetOperatorId: parsed.data.targetOperatorId },
  };
}

export type ExecutiveActionExecutor = (
  ctx: ExecCtx,
  payload: unknown
) => Promise<ExecutiveActionExecutorResult>;

export const EXECUTIVE_ACTION_EXECUTORS: Record<ExecutiveWriteActionName, ExecutiveActionExecutor> = {
  createTodo: runCreateTodo,
  assignFollowUp: runAssignFollowUp,
  createSpecializedAgent: runCreateSpecializedAgent,
  triggerBentleyAnalysis: runTriggerBentleyAnalysis,
  triggerCampaignSync: runTriggerCampaignSync,
  createSiteBuilderTask: runCreateSiteBuilderTask,
  createTrustFulfillmentPacket: runCreateTrustFulfillmentPacket,
  createRevenueOsCampaignReviewPacket: runCreateRevenueOsCampaignReviewPacket,
  recordRevenueOsLaunchReadinessCheckpoint: runRecordRevenueOsLaunchReadinessCheckpoint,
  createSmartTrustGovernanceReviewPacket: runCreateSmartTrustGovernanceReviewPacket,
  recordSmartTrustResolutionCheckpoint: runRecordSmartTrustResolutionCheckpoint,
  delegateOperationalTask: runDelegateOperationalTask,
  escalateOperationalTask: runEscalateOperationalTask,
  updateClientStatus: async () => ({
    ok: false,
    status: "failed",
    message: "updateClientStatus executor is not implemented yet — reject or extend registry.",
  }),
};

/**
 * Runs a single approved executive write after the approval row has been marked approved by the route.
 */
export async function executeExecutiveApprovedAction(
  db: Db,
  input: { adminUserId: number; approval: ExecutiveApprovalRow }
): Promise<ExecutiveActionExecutorResult> {
  const { adminUserId, approval } = input;
  const action = approval.proposedAction;
  if (!isWriteAction(action)) {
    const result: ExecutiveActionExecutorResult = {
      ok: false,
      status: "failed",
      message: `Unsupported or unknown action: ${action}`,
    };
    await auditExecutor(db, {
      adminUserId,
      approvalId: approval.id,
      proposedAction: action,
      targetType: approval.targetType,
      targetId: approval.targetId,
      payloadJson: approval.payloadJson,
      result,
    });
    return result;
  }

  let payload: unknown = {};
  try {
    payload = JSON.parse(approval.payloadJson) as unknown;
  } catch {
    const result: ExecutiveActionExecutorResult = {
      ok: false,
      status: "failed",
      message: "Approval payload is not valid JSON.",
    };
    await auditExecutor(db, {
      adminUserId,
      approvalId: approval.id,
      proposedAction: action,
      targetType: approval.targetType,
      targetId: approval.targetId,
      payloadJson: approval.payloadJson,
      result,
    });
    return result;
  }

  const exec = EXECUTIVE_ACTION_EXECUTORS[action];
  let result: ExecutiveActionExecutorResult;
  try {
    result = await exec({ db, adminUserId, approvalId: approval.id }, payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result = { ok: false, status: "failed", message: msg.slice(0, 500) };
  }

  await auditExecutor(db, {
    adminUserId,
    approvalId: approval.id,
    proposedAction: action,
    targetType: approval.targetType,
    targetId: approval.targetId,
    payloadJson: approval.payloadJson,
    result,
  });

  if (
    action === "createSiteBuilderTask" &&
    result.ok &&
    result.data?.clientNoteId &&
    typeof result.data.clientNoteId === "string"
  ) {
    await linkSiteBuilderDraftToFulfillmentDeliverable(db, {
      adminUserId,
      approvalId: approval.id,
      clientNoteId: result.data.clientNoteId,
      payload,
    });
  }

  if (
    action === "createTrustFulfillmentPacket" &&
    result.ok &&
    result.data?.clientNoteId &&
    typeof result.data.clientNoteId === "string"
  ) {
    await linkTrustPacketToFulfillmentDeliverable(db, {
      adminUserId,
      approvalId: approval.id,
      clientNoteId: result.data.clientNoteId,
      payload,
    });
  }

  if (
    action === "createRevenueOsCampaignReviewPacket" &&
    result.ok &&
    result.data?.clientNoteId &&
    typeof result.data.clientNoteId === "string"
  ) {
    await linkRevenueOsCampaignReviewToFulfillmentDeliverable(db, {
      adminUserId,
      approvalId: approval.id,
      clientNoteId: result.data.clientNoteId,
      payload,
    });
  }

  if (
    action === "createSmartTrustGovernanceReviewPacket" &&
    result.ok &&
    result.data?.clientNoteId &&
    typeof result.data.clientNoteId === "string"
  ) {
    await linkSmartTrustGovernanceReviewToFulfillmentDeliverable(db, {
      adminUserId,
      approvalId: approval.id,
      clientNoteId: result.data.clientNoteId,
      payload,
    });
  }

  return result;
}
