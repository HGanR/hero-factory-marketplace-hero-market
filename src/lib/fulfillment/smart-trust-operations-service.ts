import "server-only";

import { randomUUID } from "crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientServiceOrderEvents,
  clientServiceOrders,
  executiveAgentApprovals,
} from "@/lib/db/schema";
import {
  CreateSmartTrustGovernanceReviewPacketPayloadSchema,
  RecordSmartTrustResolutionCheckpointPayloadSchema,
} from "@/lib/executive-agent/executive-action-payloads";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  buildComplianceReminders,
  type ComplianceIntelligenceSummary,
} from "@/lib/fulfillment/smart-trust-compliance-intelligence";
import type {
  SmartTrustFulfillmentOrderDetailResultDto,
  SmartTrustFulfillmentQueueListResultDto,
} from "@/lib/fulfillment/smart-trust-fulfillment-dtos";
import {
  buildSalesSummaryExcerpt,
  isFulfillmentQueueApprovalFilter,
  toIso,
  type FulfillmentExecutiveApprovalStatus,
} from "@/lib/fulfillment/smart-trust-fulfillment-dtos";
import {
  mergeSmartTrustFulfillmentHandoff,
  parseSmartTrustFulfillmentHandoff,
} from "@/lib/fulfillment/smart-trust-fulfillment-handoff";
import {
  assessTrusteeWorkflow,
  buildGovernanceReviewPacketMarkdown,
  SMART_TRUST_GOVERNANCE_DISCLAIMER,
} from "@/lib/fulfillment/smart-trust-governance-workflow";
import { buildGovernanceReviewCheckpoint } from "@/lib/fulfillment/smart-trust-review-checkpoints";
import {
  appendProposedResolution,
  buildResolutionRecordMarkdown,
  summarizeResolutionTracking,
} from "@/lib/fulfillment/smart-trust-resolution-tracking";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import {
  FULFILLMENT_ARTIFACT_GOVERNANCE_REVIEW_PACKET,
  FULFILLMENT_ARTIFACT_TRUST_RESOLUTION_RECORD,
  FULFILLMENT_DEPARTMENT_SMART_TRUST,
  FULFILLMENT_PIPELINE_STAGES,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  type FulfillmentPipelineStage,
} from "@/lib/fulfillment/fulfillment-types";

type Db = MySql2Database<typeof schema>;

const GOVERNANCE_REVIEW_ACTION = "createSmartTrustGovernanceReviewPacket";
const RESOLUTION_RECORD_ACTION = "recordSmartTrustResolutionCheckpoint";
const ORDER_TARGET_TYPE = "client_service_order";
const DRAFTING_STAGE = "service_drafting";
const OWNER_REVIEW_STAGE = "owner_review";

export const SMART_TRUST_FULFILLMENT_SKIPPER_WARNING =
  "Skipper: Smart Trust governance is advisory only. No trust execution, legal automation, amendment application, filing, or signatures without human owner approval.";

export const ProposeSmartTrustGovernanceReviewBodySchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  trustId: z.string().uuid().optional(),
});

export const RecordSmartTrustResolutionBodySchema = z.object({
  resolutionTitle: z.string().trim().min(1).max(500),
  minutesSummary: z.string().trim().min(1).max(20_000),
  amendmentContext: z.string().trim().max(5000).optional().nullable(),
});

export type ListSmartTrustFulfillmentQueueInput = {
  adminUserId: number;
  limit?: number;
  stage?: string | null;
  approval?: string | null;
};

function parseStageFilter(stage: string | null | undefined): FulfillmentPipelineStage | null {
  const s = stage?.trim();
  if (!s) return null;
  return (FULFILLMENT_PIPELINE_STAGES as readonly string[]).includes(s)
    ? (s as FulfillmentPipelineStage)
    : null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

async function findPendingApproval(
  db: Db,
  input: { adminUserId: number; orderId: string; action: string }
): Promise<string | null> {
  const [row] = await db
    .select({ id: executiveAgentApprovals.id })
    .from(executiveAgentApprovals)
    .where(
      and(
        eq(executiveAgentApprovals.adminUserId, input.adminUserId),
        eq(executiveAgentApprovals.proposedAction, input.action),
        eq(executiveAgentApprovals.targetType, ORDER_TARGET_TYPE),
        eq(executiveAgentApprovals.targetId, input.orderId),
        eq(executiveAgentApprovals.status, "pending")
      )
    )
    .limit(1);
  return row?.id ?? null;
}

function latestApprovalByOrderId(
  rows: Array<{ id: string; targetId: string | null; status: ExecutiveApprovalStatus; proposedAction: string }>
): Map<string, { id: string; status: ExecutiveApprovalStatus; proposedAction: string }> {
  const map = new Map<string, { id: string; status: ExecutiveApprovalStatus; proposedAction: string }>();
  for (const row of rows) {
    const oid = row.targetId?.trim();
    if (!oid || map.has(oid)) continue;
    map.set(oid, { id: row.id, status: row.status, proposedAction: row.proposedAction });
  }
  return map;
}

function resolveExecutiveApprovalStatus(
  orderId: string,
  approvalMap: Map<string, { id: string; status: ExecutiveApprovalStatus; proposedAction: string }>
): {
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  approvalId: string | null;
  proposedAction: string | null;
} {
  const hit = approvalMap.get(orderId);
  if (!hit) return { approvalStatus: "none", approvalId: null, proposedAction: null };
  return { approvalStatus: hit.status, approvalId: hit.id, proposedAction: hit.proposedAction };
}

async function loadSmartTrustOrder(db: Db, input: { adminUserId: number; orderId: string }) {
  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, input.orderId),
        eq(clientServiceOrders.ownerAdminUserId, input.adminUserId),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_SMART_TRUST)
      )
    )
    .limit(1);
  return order ?? null;
}

export async function listSmartTrustFulfillmentQueueForAdmin(
  db: Db,
  input: ListSmartTrustFulfillmentQueueInput
): Promise<SmartTrustFulfillmentQueueListResultDto> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const stageFilter = parseStageFilter(input.stage ?? null);
  const approvalFilterRaw = input.approval?.trim() ?? null;
  const approvalFilter =
    approvalFilterRaw && isFulfillmentQueueApprovalFilter(approvalFilterRaw) ? approvalFilterRaw : null;

  const orderFilters = [
    eq(clientServiceOrders.ownerAdminUserId, input.adminUserId),
    eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST),
    eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_SMART_TRUST),
  ];
  if (stageFilter) orderFilters.push(eq(clientServiceOrders.pipelineStage, stageFilter));

  const orderRows = await db
    .select({
      id: clientServiceOrders.id,
      clientId: clientServiceOrders.clientId,
      pipelineStage: clientServiceOrders.pipelineStage,
      executiveHandoffJson: clientServiceOrders.executiveHandoffJson,
      createdAt: clientServiceOrders.createdAt,
      updatedAt: clientServiceOrders.updatedAt,
    })
    .from(clientServiceOrders)
    .where(and(...orderFilters))
    .orderBy(desc(clientServiceOrders.updatedAt))
    .limit(limit);

  const orderIds = orderRows.map((o) => o.id);
  const approvalRows =
    orderIds.length === 0
      ? []
      : await db
          .select({
            id: executiveAgentApprovals.id,
            targetId: executiveAgentApprovals.targetId,
            status: executiveAgentApprovals.status,
            proposedAction: executiveAgentApprovals.proposedAction,
          })
          .from(executiveAgentApprovals)
          .where(
            and(
              eq(executiveAgentApprovals.adminUserId, input.adminUserId),
              eq(executiveAgentApprovals.targetType, ORDER_TARGET_TYPE),
              inArray(executiveAgentApprovals.targetId, orderIds)
            )
          )
          .orderBy(desc(executiveAgentApprovals.createdAt));

  const approvalMap = latestApprovalByOrderId(approvalRows);
  const now = new Date();

  const orders = orderRows
    .map((o) => {
      const handoff = parseSmartTrustFulfillmentHandoff(o.executiveHandoffJson);
      const appr = resolveExecutiveApprovalStatus(o.id, approvalMap);
      const pendingGov = appr.proposedAction === GOVERNANCE_REVIEW_ACTION && appr.approvalStatus === "pending";
      const pendingRes = appr.proposedAction === RESOLUTION_RECORD_ACTION && appr.approvalStatus === "pending";
      const trustee = assessTrusteeWorkflow({
        pipelineStage: o.pipelineStage,
        handoff,
        pendingGovernanceApproval: pendingGov,
        pendingResolutionApproval: pendingRes,
      });
      const stalledDays = daysBetween(o.updatedAt, now);
      return {
        id: o.id,
        clientId: o.clientId,
        trustId: handoff.trustId,
        pipelineStage: o.pipelineStage,
        approvalStatus: appr.approvalStatus,
        approvalId: appr.approvalId,
        proposedAction: appr.proposedAction,
        governanceReviewApproved: Boolean(handoff.governanceReviewApprovedAt),
        trusteeWorkflowLabel: trustee.label,
        stalledDays: stalledDays >= 7 ? stalledDays : null,
        createdAt: toIso(o.createdAt) ?? "",
        updatedAt: toIso(o.updatedAt) ?? "",
      };
    })
    .filter((o) => (approvalFilter ? o.approvalStatus === approvalFilter : true));

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.list_smart_trust_queue",
    actionType: "read_queue",
    targetType: "smart_trust_fulfillment",
    targetId: "queue",
    inputJson: { limit, stageFilter, approvalFilter },
    outputJson: { count: orders.length },
  });

  return {
    ok: true,
    orders,
    meta: { limit, stageFilter: stageFilter ?? null, approvalFilter },
  };
}

export type GetSmartTrustFulfillmentOrderDetailResult =
  | SmartTrustFulfillmentOrderDetailResultDto
  | { ok: false; httpStatus: number; code: string; message: string };

export async function getSmartTrustFulfillmentOrderDetailForAdmin(
  db: Db,
  input: { adminUserId: number; orderId: string }
): Promise<GetSmartTrustFulfillmentOrderDetailResult> {
  const order = await loadSmartTrustOrder(db, input);
  if (!order) {
    return {
      ok: false,
      httpStatus: 404,
      code: "order_not_found",
      message: "SMART_TRUST fulfillment order not found for this admin desk.",
    };
  }

  const handoff = parseSmartTrustFulfillmentHandoff(order.executiveHandoffJson);
  const pendingGov = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: GOVERNANCE_REVIEW_ACTION,
  });
  const pendingRes = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: RESOLUTION_RECORD_ACTION,
  });

  const trusteeWorkflow = assessTrusteeWorkflow({
    pipelineStage: order.pipelineStage,
    handoff,
    pendingGovernanceApproval: Boolean(pendingGov),
    pendingResolutionApproval: Boolean(pendingRes),
  });

  const governanceReview = buildGovernanceReviewCheckpoint({
    handoff,
    pipelineStage: order.pipelineStage,
    pendingGovernanceApproval: Boolean(pendingGov),
    pendingResolutionApproval: Boolean(pendingRes),
    governanceApprovalId: pendingGov,
  });

  const resolutionTracking = summarizeResolutionTracking(handoff);
  const compliance = buildComplianceReminders({
    handoff,
    pipelineStage: order.pipelineStage,
    daysInCurrentStage: daysBetween(order.updatedAt, new Date()),
  });

  const approvalRows = await db
    .select({
      id: executiveAgentApprovals.id,
      proposedAction: executiveAgentApprovals.proposedAction,
      status: executiveAgentApprovals.status,
    })
    .from(executiveAgentApprovals)
    .where(
      and(
        eq(executiveAgentApprovals.adminUserId, input.adminUserId),
        eq(executiveAgentApprovals.targetType, ORDER_TARGET_TYPE),
        eq(executiveAgentApprovals.targetId, order.id)
      )
    )
    .orderBy(desc(executiveAgentApprovals.createdAt))
    .limit(8);

  const eventRows = await db
    .select({ createdAt: clientServiceOrderEvents.createdAt, toStage: clientServiceOrderEvents.toStage })
    .from(clientServiceOrderEvents)
    .where(eq(clientServiceOrderEvents.orderId, order.id))
    .orderBy(asc(clientServiceOrderEvents.createdAt))
    .limit(20);

  const governanceTimeline = resolutionTracking.timeline.map((t) => ({
    at: t.at,
    label: t.label,
  }));

  return {
    ok: true,
    order: {
      id: order.id,
      clientId: order.clientId,
      trustId: handoff.trustId,
      pipelineStage: order.pipelineStage,
      salesSummaryExcerpt: buildSalesSummaryExcerpt(order.salesSummaryText),
      handoff,
    },
    governanceReview,
    trusteeWorkflow,
    resolutionTracking,
    compliance,
    approvals: approvalRows.map((a) => ({
      id: a.id,
      proposedAction: a.proposedAction,
      status: a.status,
    })),
    timeline: [
      ...eventRows.map((e) => ({ at: toIso(e.createdAt) ?? "", label: e.toStage })),
      ...governanceTimeline,
    ],
    skipperWarnings: [SMART_TRUST_FULFILLMENT_SKIPPER_WARNING],
    legalBanner: SMART_TRUST_GOVERNANCE_DISCLAIMER,
  };
}

function buildGovernanceReviewPayload(
  order: { id: string; clientId: string; salesSummaryText: string | null; executiveHandoffJson: string | null },
  handoff: ReturnType<typeof parseSmartTrustFulfillmentHandoff>,
  trusteeWorkflow: ReturnType<typeof assessTrusteeWorkflow>,
  overrides?: z.infer<typeof ProposeSmartTrustGovernanceReviewBodySchema>
): z.infer<typeof CreateSmartTrustGovernanceReviewPacketPayloadSchema> {
  const trustId = overrides?.trustId?.trim() || handoff.trustId;
  if (!trustId) {
    throw new Error("trustId required");
  }
  const title =
    overrides?.title?.trim() || `Smart Trust governance review — round ${handoff.governanceReviewRound + 1}`.slice(0, 500);
  const packetMarkdown = buildGovernanceReviewPacketMarkdown({
    orderId: order.id,
    clientId: order.clientId,
    trustId,
    governanceReviewRound: handoff.governanceReviewRound + 1,
    trusteeWorkflow,
    salesSummaryExcerpt: order.salesSummaryText?.trim().slice(0, 800) ?? null,
  });
  return {
    clientId: order.clientId,
    trustId,
    title,
    packetMarkdown,
    deliverableType: FULFILLMENT_ARTIFACT_GOVERNANCE_REVIEW_PACKET,
    priority: "normal",
    fulfillmentOrderId: order.id,
    primaryService: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
    governanceReviewRound: handoff.governanceReviewRound + 1,
  };
}

export type ProposeSmartTrustGovernanceReviewResult =
  | { ok: true; approvalId: string; orderId: string; pipelineStage: string; message: string }
  | { ok: false; httpStatus: number; code: string; message: string; approvalId?: string };

export async function proposeSmartTrustGovernanceReviewFromOrder(
  db: Db,
  input: { adminUserId: number; orderId: string; body?: unknown }
): Promise<ProposeSmartTrustGovernanceReviewResult> {
  const parsedBody = ProposeSmartTrustGovernanceReviewBodySchema.safeParse(input.body ?? {});
  if (!parsedBody.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: parsedBody.error.issues.map((i) => i.message).join("; "),
    };
  }

  const order = await loadSmartTrustOrder(db, { adminUserId: input.adminUserId, orderId: input.orderId });
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "SMART_TRUST fulfillment order not found." };
  }
  if (order.pipelineStage === "released" || order.pipelineStage === "closed") {
    return {
      ok: false,
      httpStatus: 409,
      code: "order_closed",
      message: "Cannot propose governance review for a released or closed order.",
    };
  }

  const handoff = parseSmartTrustFulfillmentHandoff(order.executiveHandoffJson);
  const trustId = parsedBody.data.trustId?.trim() || handoff.trustId;
  if (!trustId) {
    return {
      ok: false,
      httpStatus: 409,
      code: "missing_trust",
      message: "Order handoff missing trustId — provide trustId in body or link trust workspace first.",
    };
  }

  const existingPending = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: GOVERNANCE_REVIEW_ACTION,
  });
  if (existingPending) {
    return {
      ok: false,
      httpStatus: 409,
      code: "approval_already_pending",
      message: "A pending governance review approval already exists for this order.",
      approvalId: existingPending,
    };
  }

  const trusteeWorkflow = assessTrusteeWorkflow({
    pipelineStage: order.pipelineStage,
    handoff: { ...handoff, trustId },
    pendingGovernanceApproval: false,
    pendingResolutionApproval: false,
  });

  let payload: z.infer<typeof CreateSmartTrustGovernanceReviewPacketPayloadSchema>;
  try {
    payload = buildGovernanceReviewPayload(order, { ...handoff, trustId }, trusteeWorkflow, parsedBody.data);
  } catch (e) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_task_payload",
      message: e instanceof Error ? e.message : "Invalid payload",
    };
  }

  const payloadValidated = CreateSmartTrustGovernanceReviewPacketPayloadSchema.safeParse(payload);
  if (!payloadValidated.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_task_payload",
      message: payloadValidated.error.issues.map((i) => i.message).join("; "),
    };
  }

  const approvalId = randomUUID();
  const fromStage = order.pipelineStage;

  await insertExecutiveApproval(db, {
    id: approvalId,
    adminUserId: input.adminUserId,
    proposedAction: GOVERNANCE_REVIEW_ACTION,
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    payloadJson: JSON.stringify(payloadValidated.data).slice(0, 100_000),
  });

  await db
    .update(clientServiceOrders)
    .set({
      pipelineStage: DRAFTING_STAGE,
      executiveHandoffJson: mergeSmartTrustFulfillmentHandoff(order.executiveHandoffJson, {
        trustId,
        governanceReviewRound: handoff.governanceReviewRound + 1,
        lastGovernanceReviewApprovalId: approvalId,
        trusteeWorkflowState: trusteeWorkflow.state,
      }),
    })
    .where(eq(clientServiceOrders.id, order.id));

  await insertFulfillmentOrderEvent(db, {
    orderId: order.id,
    actorType: "admin_human",
    actorId: String(input.adminUserId),
    fromStage,
    toStage: DRAFTING_STAGE,
    payloadJson: {
      approvalId,
      proposedAction: GOVERNANCE_REVIEW_ACTION,
      deliverableRouting: "governance_review_packet_only",
    },
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: GOVERNANCE_REVIEW_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ orderId: order.id, trustId }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.propose_smart_trust_governance_review",
    actionType: "governance_review_proposed",
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    inputJson: { approvalId, trustId },
    outputJson: { pipelineStage: DRAFTING_STAGE },
  });

  return {
    ok: true,
    approvalId,
    orderId: order.id,
    pipelineStage: DRAFTING_STAGE,
    message:
      "Governance review packet queued for executive approval. Internal note only — no trust execution or amendment application.",
  };
}

export type RecordSmartTrustResolutionResult =
  | { ok: true; approvalId: string; orderId: string; pipelineStage: string; resolutionId: string; message: string }
  | { ok: false; httpStatus: number; code: string; message: string; approvalId?: string };

export async function recordSmartTrustResolutionFromOrder(
  db: Db,
  input: { adminUserId: number; orderId: string; body?: unknown }
): Promise<RecordSmartTrustResolutionResult> {
  const parsedBody = RecordSmartTrustResolutionBodySchema.safeParse(input.body ?? {});
  if (!parsedBody.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: parsedBody.error.issues.map((i) => i.message).join("; "),
    };
  }

  const order = await loadSmartTrustOrder(db, { adminUserId: input.adminUserId, orderId: input.orderId });
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "SMART_TRUST fulfillment order not found." };
  }

  const handoff = parseSmartTrustFulfillmentHandoff(order.executiveHandoffJson);
  if (!handoff.trustId) {
    return {
      ok: false,
      httpStatus: 409,
      code: "missing_trust",
      message: "Order handoff missing trustId.",
    };
  }

  const existingPending = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: RESOLUTION_RECORD_ACTION,
  });
  if (existingPending) {
    return {
      ok: false,
      httpStatus: 409,
      code: "approval_already_pending",
      message: "A pending resolution record approval already exists.",
      approvalId: existingPending,
    };
  }

  const proposedResolution = appendProposedResolution(handoff, {
    title: parsedBody.data.resolutionTitle,
    minutesSummary: parsedBody.data.minutesSummary,
  });

  const resolutionMarkdown = buildResolutionRecordMarkdown({
    orderId: order.id,
    clientId: order.clientId,
    trustId: handoff.trustId,
    resolutionTitle: parsedBody.data.resolutionTitle,
    minutesSummary: parsedBody.data.minutesSummary,
    amendmentContext: parsedBody.data.amendmentContext ?? null,
  });

  const payload: z.infer<typeof RecordSmartTrustResolutionCheckpointPayloadSchema> = {
    clientId: order.clientId,
    trustId: handoff.trustId,
    fulfillmentOrderId: order.id,
    primaryService: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
    resolutionId: proposedResolution.id,
    resolutionTitle: parsedBody.data.resolutionTitle,
    minutesSummary: parsedBody.data.minutesSummary,
    recordMarkdown: resolutionMarkdown,
    deliverableType: FULFILLMENT_ARTIFACT_TRUST_RESOLUTION_RECORD,
  };

  const payloadValidated = RecordSmartTrustResolutionCheckpointPayloadSchema.safeParse(payload);
  if (!payloadValidated.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_task_payload",
      message: payloadValidated.error.issues.map((i) => i.message).join("; "),
    };
  }

  const approvalId = randomUUID();
  const fromStage = order.pipelineStage;
  const resolutions = [...handoff.resolutions, proposedResolution];

  await insertExecutiveApproval(db, {
    id: approvalId,
    adminUserId: input.adminUserId,
    proposedAction: RESOLUTION_RECORD_ACTION,
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    payloadJson: JSON.stringify(payloadValidated.data).slice(0, 100_000),
  });

  await db
    .update(clientServiceOrders)
    .set({
      pipelineStage: OWNER_REVIEW_STAGE,
      executiveHandoffJson: mergeSmartTrustFulfillmentHandoff(order.executiveHandoffJson, {
        resolutions,
        lastResolutionRecordApprovalId: approvalId,
        trusteeWorkflowState: "resolution_tracking",
      }),
    })
    .where(eq(clientServiceOrders.id, order.id));

  await insertFulfillmentOrderEvent(db, {
    orderId: order.id,
    actorType: "admin_human",
    actorId: String(input.adminUserId),
    fromStage,
    toStage: OWNER_REVIEW_STAGE,
    payloadJson: {
      approvalId,
      proposedAction: RESOLUTION_RECORD_ACTION,
      resolutionId: proposedResolution.id,
      trustExecution: "none",
    },
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: RESOLUTION_RECORD_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ orderId: order.id, resolutionId: proposedResolution.id }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.record_smart_trust_resolution",
    actionType: "resolution_record_proposed",
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    inputJson: { approvalId, resolutionId: proposedResolution.id },
    outputJson: { pipelineStage: OWNER_REVIEW_STAGE },
  });

  return {
    ok: true,
    approvalId,
    orderId: order.id,
    pipelineStage: OWNER_REVIEW_STAGE,
    resolutionId: proposedResolution.id,
    message:
      "Resolution/minutes record queued for owner approval. Does not file, sign, or apply trust amendments.",
  };
}

/** Read-only Skipper bundle for SMART_TRUST governance posture. */
export async function buildExecutiveSmartTrustFulfillmentForSkipper(
  db: Db,
  input: { adminUserId: number; orderId?: string | null; clientId?: string | null }
) {
  const queue = await listSmartTrustFulfillmentQueueForAdmin(db, {
    adminUserId: input.adminUserId,
    limit: 25,
  });
  const stalled = queue.orders.filter((o) => o.stalledDays != null && o.stalledDays >= 7);
  const blockedGov = queue.orders.filter(
    (o) => !o.governanceReviewApproved && o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );

  let focus: GetSmartTrustFulfillmentOrderDetailResult | null = null;
  if (input.orderId?.trim()) {
    focus = await getSmartTrustFulfillmentOrderDetailForAdmin(db, {
      adminUserId: input.adminUserId,
      orderId: input.orderId.trim(),
    });
  }

  return {
    recommendationOnly: true,
    noAutonomousTrustExecution: true,
    noLegalAutomation: true,
    noAutonomousFiling: true,
    headline: "SMART_TRUST governed governance operations — owner-approved checkpoints only.",
    queueSummary: {
      total: queue.orders.length,
      stalledCount: stalled.length,
      pendingGovernanceCheckpoint: blockedGov.length,
    },
    stalledOrders: stalled.slice(0, 8),
    focusOrder: focus && "ok" in focus && focus.ok ? focus : null,
    warnings: [SMART_TRUST_FULFILLMENT_SKIPPER_WARNING],
  };
}

export type { ComplianceIntelligenceSummary };
