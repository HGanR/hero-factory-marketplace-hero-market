import "server-only";

import { randomUUID } from "crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  campaignPosts,
  campaigns,
  clientServiceOrderEvents,
  clientServiceOrders,
  executiveAgentApprovals,
  fulfillmentDeliverables,
} from "@/lib/db/schema";
import {
  CreateRevenueOsCampaignReviewPacketPayloadSchema,
  RecordRevenueOsLaunchReadinessPayloadSchema,
} from "@/lib/executive-agent/executive-action-payloads";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  buildCampaignReviewPacketMarkdown,
  buildLaunchReadinessCheckpointMarkdown,
  buildRevenueOsCampaignReviewPayloadFromOrder,
  ProposeRevenueOsCampaignReviewBodySchema,
  REVENUE_OS_FULFILLMENT_DISCLAIMER,
} from "@/lib/fulfillment/revenue-os-campaign-review";
import type {
  RevenueOsFulfillmentOrderDetailResultDto,
  RevenueOsFulfillmentQueueListResultDto,
} from "@/lib/fulfillment/revenue-os-fulfillment-dtos";
import {
  buildSalesSummaryExcerpt,
  isFulfillmentQueueApprovalFilter,
  toIso,
  type FulfillmentExecutiveApprovalStatus,
} from "@/lib/fulfillment/revenue-os-fulfillment-dtos";
import {
  mergeRevenueOsFulfillmentHandoff,
  parseRevenueOsFulfillmentHandoff,
} from "@/lib/fulfillment/revenue-os-fulfillment-handoff";
import { buildRevenueOsKpiSnapshot } from "@/lib/fulfillment/revenue-os-kpi-snapshot";
import { buildLaunchReadinessAssessment } from "@/lib/fulfillment/revenue-os-launch-readiness";
import { buildRevisionIntelligence } from "@/lib/fulfillment/revenue-os-revision-intelligence";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import {
  FULFILLMENT_DEPARTMENT_AI_REVENUE_OS,
  FULFILLMENT_PIPELINE_STAGES,
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  type FulfillmentPipelineStage,
} from "@/lib/fulfillment/fulfillment-types";

type Db = MySql2Database<typeof schema>;

const CAMPAIGN_REVIEW_ACTION = "createRevenueOsCampaignReviewPacket";
const LAUNCH_READINESS_ACTION = "recordRevenueOsLaunchReadinessCheckpoint";
const ORDER_TARGET_TYPE = "client_service_order";
const DRAFTING_STAGE = "service_drafting";
const OWNER_REVIEW_STAGE = "owner_review";

export const REVENUE_OS_FULFILLMENT_SKIPPER_WARNING =
  "Skipper: recommend only. Campaign launch, publish, ad spend, and Content360 execution require owner approval — never autonomous.";

export { ProposeRevenueOsCampaignReviewBodySchema };

export type ListRevenueOsFulfillmentQueueInput = {
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

async function loadRevenueOsOrder(db: Db, input: { adminUserId: number; orderId: string }) {
  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, input.orderId),
        eq(clientServiceOrders.ownerAdminUserId, input.adminUserId),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_AI_REVENUE_OS)
      )
    )
    .limit(1);
  return order ?? null;
}

async function loadCampaignForHandoff(db: Db, campaignId: string | null) {
  if (!campaignId) return null;
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  return row ?? null;
}

export async function listRevenueOsFulfillmentQueueForAdmin(
  db: Db,
  input: ListRevenueOsFulfillmentQueueInput
): Promise<RevenueOsFulfillmentQueueListResultDto> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const stageFilter = parseStageFilter(input.stage ?? null);
  const approvalFilterRaw = input.approval?.trim() ?? null;
  const approvalFilter =
    approvalFilterRaw && isFulfillmentQueueApprovalFilter(approvalFilterRaw) ? approvalFilterRaw : null;

  const orderFilters = [
    eq(clientServiceOrders.ownerAdminUserId, input.adminUserId),
    eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS),
    eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_AI_REVENUE_OS),
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
      const handoff = parseRevenueOsFulfillmentHandoff(o.executiveHandoffJson);
      const appr = resolveExecutiveApprovalStatus(o.id, approvalMap);
      const stalledDays = daysBetween(o.updatedAt, now);
      return {
        id: o.id,
        clientId: o.clientId,
        campaignId: handoff.campaignId,
        pipelineStage: o.pipelineStage,
        approvalStatus: appr.approvalStatus,
        approvalId: appr.approvalId,
        proposedAction: appr.proposedAction,
        launchReadinessApproved: Boolean(handoff.launchReadinessApprovedAt),
        stalledDays: stalledDays >= 7 ? stalledDays : null,
        createdAt: toIso(o.createdAt) ?? "",
        updatedAt: toIso(o.updatedAt) ?? "",
      };
    })
    .filter((o) => (approvalFilter ? o.approvalStatus === approvalFilter : true));

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.list_revenue_os_queue",
    actionType: "read_queue",
    targetType: "revenue_os_fulfillment",
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

export type GetRevenueOsFulfillmentOrderDetailResult =
  | RevenueOsFulfillmentOrderDetailResultDto
  | { ok: false; httpStatus: number; code: string; message: string };

export async function getRevenueOsFulfillmentOrderDetailForAdmin(
  db: Db,
  input: { adminUserId: number; orderId: string }
): Promise<GetRevenueOsFulfillmentOrderDetailResult> {
  const order = await loadRevenueOsOrder(db, input);
  if (!order) {
    return {
      ok: false,
      httpStatus: 404,
      code: "order_not_found",
      message: "REVENUE_OS fulfillment order not found for this admin desk.",
    };
  }

  const handoff = parseRevenueOsFulfillmentHandoff(order.executiveHandoffJson);
  const campaign = await loadCampaignForHandoff(db, handoff.campaignId);
  const posts =
    campaign && handoff.campaignId
      ? await db
          .select({ status: campaignPosts.status })
          .from(campaignPosts)
          .where(eq(campaignPosts.campaignId, handoff.campaignId))
      : [];

  const [deliverable] = await db
    .select()
    .from(fulfillmentDeliverables)
    .where(eq(fulfillmentDeliverables.orderId, order.id))
    .limit(1);

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

  const pendingReview = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: CAMPAIGN_REVIEW_ACTION,
  });
  const pendingLaunch = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: LAUNCH_READINESS_ACTION,
  });

  const launchApprovalStatus: "none" | "pending" | "approved" = pendingLaunch
    ? "pending"
    : handoff.launchReadinessApprovedAt
      ? "approved"
      : "none";

  const kpiSnapshot = buildRevenueOsKpiSnapshot({
    campaignStatus: campaign?.status ?? null,
    posts,
    hasBentleyPayload: Boolean(campaign?.bentleyGenerationJson),
    launchReadinessApproved: Boolean(handoff.launchReadinessApprovedAt),
    daysSinceUpdate: campaign?.updatedAt ? daysBetween(campaign.updatedAt, new Date()) : null,
  });

  const launchReadiness = buildLaunchReadinessAssessment({
    hasCampaign: Boolean(campaign),
    hasBentleyPayload: Boolean(campaign?.bentleyGenerationJson),
    campaignStatus: campaign?.status ?? null,
    postCounts: kpiSnapshot.postCounts,
    ownerReviewStatus: deliverable?.ownerReviewStatus ?? null,
    pipelineStage: order.pipelineStage,
    launchReadinessApprovedAt: handoff.launchReadinessApprovedAt,
    pendingLaunchApproval: Boolean(pendingLaunch),
    websiteOrderReleased: null,
    trustOrderAtOwnerReview: null,
    launchApprovalId: pendingLaunch,
    launchApprovalStatus,
  });

  const revisionIntelligence = buildRevisionIntelligence({
    revisionRound: handoff.revisionRound,
    draftVersion: deliverable?.draftVersion ?? 1,
    ownerReviewStatus: deliverable?.ownerReviewStatus ?? null,
    clientDeliveryStatus: deliverable?.clientDeliveryStatus ?? null,
    pipelineStage: order.pipelineStage,
    daysInCurrentStage: daysBetween(order.updatedAt, new Date()),
  });

  const campaignReviewStatus = pendingReview
    ? "proposed"
    : deliverable?.ownerReviewStatus === "approved"
      ? "approved"
      : deliverable?.ownerReviewStatus === "rejected"
        ? "revision_requested"
        : "draft";

  const eventRows = await db
    .select({ createdAt: clientServiceOrderEvents.createdAt, toStage: clientServiceOrderEvents.toStage })
    .from(clientServiceOrderEvents)
    .where(eq(clientServiceOrderEvents.orderId, order.id))
    .orderBy(asc(clientServiceOrderEvents.createdAt))
    .limit(20);

  return {
    ok: true,
    order: {
      id: order.id,
      clientId: order.clientId,
      campaignId: handoff.campaignId,
      pipelineStage: order.pipelineStage,
      salesSummaryExcerpt: buildSalesSummaryExcerpt(order.salesSummaryText),
      handoff,
    },
    campaignReview: {
      status: campaignReviewStatus,
      approvalId: pendingReview,
      revisionRound: handoff.revisionRound,
      packetPreview: campaign
        ? buildCampaignReviewPacketMarkdown({
            orderId: order.id,
            clientId: order.clientId,
            intake: {
              campaignId: campaign.id,
              campaignName: campaign.name,
              campaignStatus: campaign.status,
              objective: campaign.objective ?? null,
              bentleyGenerationJson: (campaign.bentleyGenerationJson as Record<string, unknown> | null) ?? null,
            },
            salesSummaryExcerpt: order.salesSummaryText?.trim().slice(0, 800) ?? null,
            revisionRound: handoff.revisionRound,
          }).slice(0, 1200)
        : null,
    },
    launchReadiness,
    kpiSnapshot,
    revisionIntelligence,
    approvals: approvalRows.map((a) => ({
      id: a.id,
      proposedAction: a.proposedAction,
      status: a.status,
    })),
    timeline: eventRows.map((e) => ({
      at: toIso(e.createdAt) ?? "",
      label: e.toStage,
    })),
    skipperWarnings: [REVENUE_OS_FULFILLMENT_SKIPPER_WARNING],
    legalBanner: REVENUE_OS_FULFILLMENT_DISCLAIMER,
  };
}

export type ProposeRevenueOsCampaignReviewResult =
  | { ok: true; approvalId: string; orderId: string; pipelineStage: string; message: string }
  | { ok: false; httpStatus: number; code: string; message: string; approvalId?: string };

export async function proposeRevenueOsCampaignReviewFromOrder(
  db: Db,
  input: { adminUserId: number; orderId: string; body?: unknown }
): Promise<ProposeRevenueOsCampaignReviewResult> {
  const parsedBody = ProposeRevenueOsCampaignReviewBodySchema.safeParse(input.body ?? {});
  if (!parsedBody.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: parsedBody.error.issues.map((i) => i.message).join("; "),
    };
  }

  const order = await loadRevenueOsOrder(db, { adminUserId: input.adminUserId, orderId: input.orderId });
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "REVENUE_OS fulfillment order not found." };
  }
  if (order.pipelineStage === "released" || order.pipelineStage === "closed") {
    return {
      ok: false,
      httpStatus: 409,
      code: "order_closed",
      message: "Cannot propose campaign review for a released or closed order.",
    };
  }

  const handoff = parseRevenueOsFulfillmentHandoff(order.executiveHandoffJson);
  if (!handoff.campaignId) {
    return {
      ok: false,
      httpStatus: 409,
      code: "missing_campaign",
      message: "Order handoff missing campaignId — link campaign before proposing review.",
    };
  }

  const campaign = await loadCampaignForHandoff(db, handoff.campaignId);
  if (!campaign) {
    return { ok: false, httpStatus: 404, code: "campaign_not_found", message: "Linked campaign not found." };
  }

  const existingPending = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: CAMPAIGN_REVIEW_ACTION,
  });
  if (existingPending) {
    return {
      ok: false,
      httpStatus: 409,
      code: "approval_already_pending",
      message: "A pending campaign review approval already exists for this order.",
      approvalId: existingPending,
    };
  }

  const payload = buildRevenueOsCampaignReviewPayloadFromOrder(
    order,
    {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      objective: campaign.objective ?? null,
      bentleyGenerationJson: (campaign.bentleyGenerationJson as Record<string, unknown> | null) ?? null,
    },
    parsedBody.data
  );
  const payloadValidated = CreateRevenueOsCampaignReviewPacketPayloadSchema.safeParse(payload);
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
    proposedAction: CAMPAIGN_REVIEW_ACTION,
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    payloadJson: JSON.stringify(payloadValidated.data).slice(0, 100_000),
  });

  await db
    .update(clientServiceOrders)
    .set({
      pipelineStage: DRAFTING_STAGE,
      executiveHandoffJson: mergeRevenueOsFulfillmentHandoff(order.executiveHandoffJson, {
        lastCampaignReviewApprovalId: approvalId,
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
      proposedAction: CAMPAIGN_REVIEW_ACTION,
      deliverableRouting: "campaign_review_packet_only",
    },
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: CAMPAIGN_REVIEW_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ orderId: order.id, campaignId: handoff.campaignId }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.propose_revenue_os_campaign_review",
    actionType: "campaign_review_proposed",
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    inputJson: { approvalId, campaignId: handoff.campaignId },
    outputJson: { pipelineStage: DRAFTING_STAGE },
  });

  return {
    ok: true,
    approvalId,
    orderId: order.id,
    pipelineStage: DRAFTING_STAGE,
    message:
      "Campaign review packet queued for executive approval. Approve via approvals UI — internal note only; no publish or launch.",
  };
}

export const ApproveRevenueOsLaunchReadinessBodySchema = z.object({
  readinessSummary: z.string().trim().min(1).max(20_000),
  ownerAttestation: z.string().trim().min(1).max(2000),
  blockersResolved: z.array(z.string().trim().max(500)).max(30).optional().default([]),
});

export type ProposeRevenueOsLaunchReadinessResult =
  | { ok: true; approvalId: string; orderId: string; pipelineStage: string; message: string }
  | { ok: false; httpStatus: number; code: string; message: string; approvalId?: string };

export async function proposeRevenueOsLaunchReadinessFromOrder(
  db: Db,
  input: { adminUserId: number; orderId: string; body?: unknown }
): Promise<ProposeRevenueOsLaunchReadinessResult> {
  const parsedBody = ApproveRevenueOsLaunchReadinessBodySchema.safeParse(input.body ?? {});
  if (!parsedBody.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: parsedBody.error.issues.map((i) => i.message).join("; "),
    };
  }

  const order = await loadRevenueOsOrder(db, { adminUserId: input.adminUserId, orderId: input.orderId });
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "REVENUE_OS fulfillment order not found." };
  }

  const handoff = parseRevenueOsFulfillmentHandoff(order.executiveHandoffJson);
  if (!handoff.campaignId) {
    return {
      ok: false,
      httpStatus: 409,
      code: "missing_campaign",
      message: "Order handoff missing campaignId.",
    };
  }

  const detail = await getRevenueOsFulfillmentOrderDetailForAdmin(db, input);
  if (!detail.ok) {
    return { ok: false, httpStatus: detail.httpStatus, code: detail.code, message: detail.message };
  }

  const existingPending = await findPendingApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
    action: LAUNCH_READINESS_ACTION,
  });
  if (existingPending) {
    return {
      ok: false,
      httpStatus: 409,
      code: "approval_already_pending",
      message: "A pending launch readiness approval already exists.",
      approvalId: existingPending,
    };
  }

  const checkpointMd = buildLaunchReadinessCheckpointMarkdown({
    orderId: order.id,
    clientId: order.clientId,
    campaignId: handoff.campaignId,
    readinessSummary: parsedBody.data.readinessSummary,
    blockers: detail.launchReadiness.blockers,
    ownerAttestation: parsedBody.data.ownerAttestation,
  });

  const payload = {
    clientId: order.clientId,
    campaignId: handoff.campaignId,
    fulfillmentOrderId: order.id,
    primaryService: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS as const,
    readinessSummary: parsedBody.data.readinessSummary,
    blockersResolved: parsedBody.data.blockersResolved ?? [],
    ownerAttestation: parsedBody.data.ownerAttestation,
  };
  const payloadValidated = RecordRevenueOsLaunchReadinessPayloadSchema.safeParse({
    ...payload,
    readinessSummary: checkpointMd.slice(0, 20_000),
  });
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
    proposedAction: LAUNCH_READINESS_ACTION,
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    payloadJson: JSON.stringify(payloadValidated.data).slice(0, 100_000),
  });

  await db
    .update(clientServiceOrders)
    .set({
      pipelineStage: OWNER_REVIEW_STAGE,
      executiveHandoffJson: mergeRevenueOsFulfillmentHandoff(order.executiveHandoffJson, {
        lastLaunchReadinessApprovalId: approvalId,
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
      proposedAction: LAUNCH_READINESS_ACTION,
      launchExecution: "none",
    },
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: LAUNCH_READINESS_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ orderId: order.id, campaignId: handoff.campaignId }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.propose_revenue_os_launch_readiness",
    actionType: "launch_readiness_proposed",
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    inputJson: { approvalId },
    outputJson: { pipelineStage: OWNER_REVIEW_STAGE },
  });

  return {
    ok: true,
    approvalId,
    orderId: order.id,
    pipelineStage: OWNER_REVIEW_STAGE,
    message:
      "Launch readiness checkpoint queued for owner approval. Does not execute sync-launch, publish, or ad spend.",
  };
}

/** Read-only Skipper bundle for REVENUE_OS fulfillment posture. */
export async function buildExecutiveRevenueOsFulfillmentForSkipper(
  db: Db,
  input: { adminUserId: number; orderId?: string | null; clientId?: string | null }
) {
  const queue = await listRevenueOsFulfillmentQueueForAdmin(db, {
    adminUserId: input.adminUserId,
    limit: 25,
  });
  const stalled = queue.orders.filter((o) => o.stalledDays != null && o.stalledDays >= 7);
  const blockedLaunch = queue.orders.filter((o) => !o.launchReadinessApproved && o.pipelineStage !== "released");

  let focus: GetRevenueOsFulfillmentOrderDetailResult | null = null;
  if (input.orderId?.trim()) {
    focus = await getRevenueOsFulfillmentOrderDetailForAdmin(db, {
      adminUserId: input.adminUserId,
      orderId: input.orderId.trim(),
    });
  }

  return {
    recommendationOnly: true,
    noAutonomousLaunch: true,
    noAutonomousPublish: true,
    noContent360Bypass: true,
    headline: "REVENUE_OS governed campaign fulfillment — owner-approved checkpoints only.",
    queueSummary: {
      total: queue.orders.length,
      stalledCount: stalled.length,
      pendingLaunchCheckpoint: blockedLaunch.length,
    },
    stalledCampaigns: stalled.slice(0, 8),
    focusOrder: focus && "ok" in focus && focus.ok ? focus : null,
    warnings: [REVENUE_OS_FULFILLMENT_SKIPPER_WARNING],
  };
}
