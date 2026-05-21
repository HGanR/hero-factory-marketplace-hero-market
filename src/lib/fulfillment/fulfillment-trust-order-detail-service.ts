import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientServiceOrderEvents,
  clientServiceOrders,
  executiveAgentApprovals,
  fulfillmentDeliverables,
  paymentConfirmations,
} from "@/lib/db/schema";
import type { TrustFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/fulfillment-trust-order-detail-dtos";
import {
  TRUST_FULFILLMENT_LEGAL_BANNER,
  TRUST_FULFILLMENT_SKIPPER_WARNING,
} from "@/lib/fulfillment/fulfillment-trust-legal";
import {
  buildTrustFulfillmentOrderTimeline,
  buildTrustNextActionDto,
  hasClaudeHandoffEvent,
  parseRequestedDeliverableSummary,
  resolveTrustNextAdminAction,
  type OrderEventRow,
} from "@/lib/fulfillment/fulfillment-trust-order-detail-logic";
import { loadTrustDeliverableDraftForOrder } from "@/lib/fulfillment/fulfillment-trust-deliverable-draft";
import {
  buildSalesSummaryExcerpt,
  maskPaymentExternalRef,
  toIso,
  type FulfillmentExecutiveApprovalStatus,
} from "@/lib/fulfillment/fulfillment-trust-queue-dtos";
import { auditFulfillmentExecutiveAction } from "@/lib/fulfillment/fulfillment-audit";
import { loadTrustIntakeFromOrder } from "@/lib/fulfillment/trust-intake-summary";
import {
  FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
} from "@/lib/fulfillment/fulfillment-types";

type Db = MySql2Database<typeof schema>;

const TRUST_PACKET_APPROVAL_ACTION = "createTrustFulfillmentPacket";

export type GetTrustFulfillmentOrderDetailResult =
  | TrustFulfillmentOrderDetailResultDto
  | { ok: false; httpStatus: number; code: string; message: string };

export async function getTrustFulfillmentOrderDetailForAdmin(
  db: Db,
  input: { adminUserId: number; orderId: string }
): Promise<GetTrustFulfillmentOrderDetailResult> {
  const orderId = input.orderId.trim();
  if (!orderId) {
    return { ok: false, httpStatus: 400, code: "invalid_order_id", message: "Order id is required." };
  }

  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, orderId),
        eq(clientServiceOrders.ownerAdminUserId, input.adminUserId),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_TRUST),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_TRUST_RECORDS)
      )
    )
    .limit(1);

  if (!order) {
    return {
      ok: false,
      httpStatus: 404,
      code: "order_not_found",
      message: "TRUST fulfillment order not found for this admin desk.",
    };
  }

  const [payment, deliverable, eventRows, approvalRows] = await Promise.all([
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
      .where(eq(paymentConfirmations.id, order.paymentConfirmationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
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
      .where(eq(fulfillmentDeliverables.orderId, order.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: clientServiceOrderEvents.id,
        actorType: clientServiceOrderEvents.actorType,
        actorId: clientServiceOrderEvents.actorId,
        fromStage: clientServiceOrderEvents.fromStage,
        toStage: clientServiceOrderEvents.toStage,
        payloadJson: clientServiceOrderEvents.payloadJson,
        createdAt: clientServiceOrderEvents.createdAt,
      })
      .from(clientServiceOrderEvents)
      .where(eq(clientServiceOrderEvents.orderId, order.id))
      .orderBy(asc(clientServiceOrderEvents.createdAt)),
    db
      .select({
        id: executiveAgentApprovals.id,
        status: executiveAgentApprovals.status,
        proposedAction: executiveAgentApprovals.proposedAction,
        createdAt: executiveAgentApprovals.createdAt,
        executedAt: executiveAgentApprovals.executedAt,
      })
      .from(executiveAgentApprovals)
      .where(
        and(
          eq(executiveAgentApprovals.adminUserId, input.adminUserId),
          eq(executiveAgentApprovals.proposedAction, TRUST_PACKET_APPROVAL_ACTION),
          eq(executiveAgentApprovals.targetId, order.id),
          or(
            eq(executiveAgentApprovals.targetType, "client_service_order"),
            eq(executiveAgentApprovals.targetType, "fulfillment_order")
          )
        )
      )
      .orderBy(desc(executiveAgentApprovals.createdAt))
      .limit(1),
  ]);

  const approval = approvalRows[0] ?? null;
  const approvalStatus: FulfillmentExecutiveApprovalStatus = approval?.status ?? "none";
  const events = eventRows as OrderEventRow[];
  const handoffEvent = hasClaudeHandoffEvent(events);

  const paymentStatus = payment?.status ?? "pending";
  const paymentConsumed = Boolean(payment?.consumedAt ?? payment?.consumedByOrderId);

  const deliverableDraft = await loadTrustDeliverableDraftForOrder(db, {
    orderId: order.id,
    adminUserId: input.adminUserId,
  });

  const nextActionKey = resolveTrustNextAdminAction({
    pipelineStage: order.pipelineStage,
    paymentStatus,
    paymentConsumed,
    approvalStatus,
    hasClaudeHandoffEvent: handoffEvent,
    orderSource: order.source,
    deliverableLinked: deliverableDraft?.linked ?? Boolean(deliverable?.artifactRef),
    deliverableReviewStatus: deliverable?.ownerReviewStatus,
  });

  const trustIntakePkg = loadTrustIntakeFromOrder({
    executiveHandoffJson: order.executiveHandoffJson,
    salesSummaryText: order.salesSummaryText,
    requestedDeliverableJson: order.requestedDeliverableJson,
  });

  const timeline = buildTrustFulfillmentOrderTimeline({
    paymentConfirmedAt: payment?.confirmedAt ?? null,
    paymentStatus,
    events,
    approval: approval
      ? {
          id: approval.id,
          status: approval.status,
          proposedAction: approval.proposedAction,
          createdAt: approval.createdAt,
          executedAt: approval.executedAt,
        }
      : null,
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment_trust_order.detail",
    actionType: "order_detail_viewed",
    targetType: "client_service_order",
    targetId: order.id,
    inputJson: { clientId: order.clientId, pipelineStage: order.pipelineStage },
    outputJson: {
      nextAction: nextActionKey,
      timelineCount: timeline.length,
      readinessScore: trustIntakePkg.readiness.score,
    },
  });

  return {
    ok: true,
    order: {
      orderId: order.id,
      clientId: order.clientId,
      pipelineStage: order.pipelineStage,
      approvalStatus,
      approvalId: approval?.id ?? null,
      proposedAction: approval?.proposedAction ?? null,
      paymentConfirmation: {
        id: payment?.id ?? order.paymentConfirmationId,
        status: paymentStatus,
        provider: payment?.provider ?? "unknown",
        confirmedAt: toIso(payment?.confirmedAt ?? null),
        consumedAt: toIso(payment?.consumedAt ?? null),
        consumedByOrderId: payment?.consumedByOrderId ?? null,
        externalRefMasked: maskPaymentExternalRef(payment?.externalRef ?? null),
      },
      createdAt: toIso(order.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(order.updatedAt ?? null),
      salesSummaryExcerpt: buildSalesSummaryExcerpt(order.salesSummaryText),
      requestedDeliverable: parseRequestedDeliverableSummary(order.requestedDeliverableJson),
      deliverable: deliverable
        ? {
            id: deliverable.id,
            department: deliverable.department,
            artifactType: deliverable.artifactType,
            ownerReviewStatus: deliverable.ownerReviewStatus,
            artifactRef: deliverable.artifactRef ?? null,
          }
        : null,
      assignedDepartment: order.assignedDepartment,
      service: { primary: FULFILLMENT_PRIMARY_SERVICE_TRUST },
      source: order.source,
    },
    paymentConfirmation: {
      id: payment?.id ?? order.paymentConfirmationId,
      status: paymentStatus,
      provider: payment?.provider ?? "unknown",
      confirmedAt: toIso(payment?.confirmedAt ?? null),
      consumedAt: toIso(payment?.consumedAt ?? null),
      consumedByOrderId: payment?.consumedByOrderId ?? null,
      externalRefMasked: maskPaymentExternalRef(payment?.externalRef ?? null),
    },
    deliverable: deliverable
      ? {
          id: deliverable.id,
          department: deliverable.department,
          artifactType: deliverable.artifactType,
          ownerReviewStatus: deliverable.ownerReviewStatus,
          artifactRef: deliverable.artifactRef ?? null,
        }
      : null,
    approval: approval
      ? {
          id: approval.id,
          status: approval.status,
          proposedAction: approval.proposedAction,
          createdAt: toIso(approval.createdAt),
          executedAt: toIso(approval.executedAt),
        }
      : null,
    timeline,
    nextAction: buildTrustNextActionDto(nextActionKey),
    trustIntake: {
      normalized: trustIntakePkg.normalized,
      readiness: trustIntakePkg.readiness,
      skipperSummary: trustIntakePkg.skipperSummary,
    },
    deliverableDraft,
    legal: {
      banner: TRUST_FULFILLMENT_LEGAL_BANNER,
      skipperWarning: TRUST_FULFILLMENT_SKIPPER_WARNING,
    },
    meta: { primaryService: FULFILLMENT_PRIMARY_SERVICE_TRUST },
  };
}
