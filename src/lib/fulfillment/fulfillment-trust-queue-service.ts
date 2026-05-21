import "server-only";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientServiceOrders,
  executiveAgentApprovals,
  fulfillmentDeliverables,
  paymentConfirmations,
} from "@/lib/db/schema";
import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import { auditFulfillmentExecutiveAction } from "@/lib/fulfillment/fulfillment-audit";
import {
  buildSalesSummaryExcerpt,
  isFulfillmentQueueApprovalFilter,
  maskPaymentExternalRef,
  toIso,
  type FulfillmentExecutiveApprovalStatus,
  type FulfillmentQueueApprovalFilter,
  type TrustFulfillmentQueueListResultDto,
  type TrustFulfillmentQueueOrderSummaryDto,
} from "@/lib/fulfillment/fulfillment-trust-queue-dtos";
import {
  FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
  FULFILLMENT_PIPELINE_STAGES,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  type FulfillmentPipelineStage,
} from "@/lib/fulfillment/fulfillment-types";

type Db = MySql2Database<typeof schema>;

const TRUST_PACKET_APPROVAL_ACTION = "createTrustFulfillmentPacket";

export type ListTrustFulfillmentQueueInput = {
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

function latestApprovalByOrderId(
  rows: Array<{
    id: string;
    targetId: string | null;
    status: ExecutiveApprovalStatus;
    proposedAction: string;
  }>
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
  if (!hit) {
    return { approvalStatus: "none", approvalId: null, proposedAction: null };
  }
  return {
    approvalStatus: hit.status,
    approvalId: hit.id,
    proposedAction: hit.proposedAction,
  };
}

function matchesApprovalFilter(
  approvalStatus: FulfillmentExecutiveApprovalStatus,
  filter: FulfillmentQueueApprovalFilter
): boolean {
  return approvalStatus === filter;
}

export async function listTrustFulfillmentQueueForAdmin(
  db: Db,
  input: ListTrustFulfillmentQueueInput
): Promise<TrustFulfillmentQueueListResultDto> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const stageFilter = parseStageFilter(input.stage ?? null);
  const approvalFilterRaw = input.approval?.trim() ?? null;
  const approvalFilter =
    approvalFilterRaw && isFulfillmentQueueApprovalFilter(approvalFilterRaw)
      ? approvalFilterRaw
      : null;

  const orderFilters = [
    eq(clientServiceOrders.ownerAdminUserId, input.adminUserId),
    eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_TRUST),
    eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_TRUST_RECORDS),
  ];
  if (stageFilter) {
    orderFilters.push(eq(clientServiceOrders.pipelineStage, stageFilter));
  }

  const orderRows = await db
    .select({
      id: clientServiceOrders.id,
      clientId: clientServiceOrders.clientId,
      pipelineStage: clientServiceOrders.pipelineStage,
      paymentConfirmationId: clientServiceOrders.paymentConfirmationId,
      assignedDepartment: clientServiceOrders.assignedDepartment,
      primaryService: clientServiceOrders.primaryService,
      salesSummaryText: clientServiceOrders.salesSummaryText,
      createdAt: clientServiceOrders.createdAt,
    })
    .from(clientServiceOrders)
    .where(and(...orderFilters))
    .orderBy(desc(clientServiceOrders.createdAt))
    .limit(limit * 3);

  const orderIds = orderRows.map((o) => o.id);
  if (!orderIds.length) {
    await auditFulfillmentExecutiveAction(db, {
      adminUserId: input.adminUserId,
      toolName: "fulfillment_trust_queue.list",
      actionType: "queue_accessed",
      targetType: "platform",
      inputJson: { limit, stageFilter, approvalFilter, returned: 0 },
      outputJson: { returned: 0 },
    });
    return {
      ok: true,
      orders: [],
      meta: {
        limit,
        returned: 0,
        stageFilter: stageFilter ?? null,
        approvalFilter,
        primaryService: FULFILLMENT_PRIMARY_SERVICE_TRUST,
      },
    };
  }

  const paymentIds = [...new Set(orderRows.map((o) => o.paymentConfirmationId))];

  const [payments, deliverables, approvalRows] = await Promise.all([
    db
      .select({
        id: paymentConfirmations.id,
        status: paymentConfirmations.status,
        provider: paymentConfirmations.provider,
        confirmedAt: paymentConfirmations.confirmedAt,
        consumedAt: paymentConfirmations.consumedAt,
        consumedByOrderId: paymentConfirmations.consumedByOrderId,
        externalRef: paymentConfirmations.externalRef,
      })
      .from(paymentConfirmations)
      .where(inArray(paymentConfirmations.id, paymentIds)),
    db
      .select({
        id: fulfillmentDeliverables.id,
        orderId: fulfillmentDeliverables.orderId,
        department: fulfillmentDeliverables.department,
        artifactType: fulfillmentDeliverables.artifactType,
        ownerReviewStatus: fulfillmentDeliverables.ownerReviewStatus,
        artifactRef: fulfillmentDeliverables.artifactRef,
      })
      .from(fulfillmentDeliverables)
      .where(inArray(fulfillmentDeliverables.orderId, orderIds)),
    db
      .select({
        id: executiveAgentApprovals.id,
        targetId: executiveAgentApprovals.targetId,
        status: executiveAgentApprovals.status,
        proposedAction: executiveAgentApprovals.proposedAction,
        createdAt: executiveAgentApprovals.createdAt,
      })
      .from(executiveAgentApprovals)
      .where(
        and(
          eq(executiveAgentApprovals.adminUserId, input.adminUserId),
          eq(executiveAgentApprovals.proposedAction, TRUST_PACKET_APPROVAL_ACTION),
          inArray(executiveAgentApprovals.targetId, orderIds),
          or(
            eq(executiveAgentApprovals.targetType, "client_service_order"),
            eq(executiveAgentApprovals.targetType, "fulfillment_order")
          )
        )
      )
      .orderBy(desc(executiveAgentApprovals.createdAt)),
  ]);

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const deliverableByOrderId = new Map(deliverables.map((d) => [d.orderId, d]));
  const approvalByOrderId = latestApprovalByOrderId(approvalRows);

  const summaries: TrustFulfillmentQueueOrderSummaryDto[] = [];

  for (const o of orderRows) {
    const execApproval = resolveExecutiveApprovalStatus(o.id, approvalByOrderId);
    if (approvalFilter && !matchesApprovalFilter(execApproval.approvalStatus, approvalFilter)) {
      continue;
    }

    const pay = paymentById.get(o.paymentConfirmationId);
    const del = deliverableByOrderId.get(o.id);

    summaries.push({
      orderId: o.id,
      clientId: o.clientId,
      pipelineStage: o.pipelineStage,
      approvalStatus: execApproval.approvalStatus,
      approvalId: execApproval.approvalId,
      proposedAction: execApproval.proposedAction,
      paymentConfirmation: {
        id: pay?.id ?? o.paymentConfirmationId,
        status: pay?.status ?? "pending",
        provider: pay?.provider ?? "unknown",
        confirmedAt: toIso(pay?.confirmedAt ?? null),
        consumedAt: toIso(pay?.consumedAt ?? null),
        consumedByOrderId: pay?.consumedByOrderId ?? null,
        externalRefMasked: maskPaymentExternalRef(pay?.externalRef ?? null),
      },
      createdAt: toIso(o.createdAt) ?? new Date().toISOString(),
      salesSummaryExcerpt: buildSalesSummaryExcerpt(o.salesSummaryText),
      deliverable: del
        ? {
            id: del.id,
            department: del.department,
            artifactType: del.artifactType,
            ownerReviewStatus: del.ownerReviewStatus,
            artifactRef: del.artifactRef ?? null,
          }
        : null,
      assignedDepartment: o.assignedDepartment,
      service: { primary: FULFILLMENT_PRIMARY_SERVICE_TRUST },
    });

    if (summaries.length >= limit) break;
  }

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment_trust_queue.list",
    actionType: "queue_accessed",
    targetType: "platform",
    inputJson: { limit, stageFilter, approvalFilter },
    outputJson: { returned: summaries.length },
  });

  return {
    ok: true,
    orders: summaries,
    meta: {
      limit,
      returned: summaries.length,
      stageFilter: stageFilter ?? null,
      approvalFilter,
      primaryService: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    },
  };
}
