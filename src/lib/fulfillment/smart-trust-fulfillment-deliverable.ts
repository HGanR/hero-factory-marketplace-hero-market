import "server-only";

import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clientServiceOrders, fulfillmentDeliverables } from "@/lib/db/schema";
import { insertFulfillmentOrderEvent } from "@/lib/fulfillment/fulfillment-audit";
import {
  markResolutionRecorded,
  mergeSmartTrustFulfillmentHandoff,
  parseSmartTrustFulfillmentHandoff,
} from "@/lib/fulfillment/smart-trust-fulfillment-handoff";
import {
  FULFILLMENT_DEPARTMENT_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
} from "@/lib/fulfillment/fulfillment-types";

type Db = MySql2Database<typeof schema>;

function parseFulfillmentOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { fulfillmentOrderId?: string }).fulfillmentOrderId?.trim();
  return id || null;
}

async function loadOrder(db: Db, orderId: string, adminUserId: number) {
  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, orderId),
        eq(clientServiceOrders.ownerAdminUserId, adminUserId),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_SMART_TRUST)
      )
    )
    .limit(1);
  return order ?? null;
}

export async function linkSmartTrustGovernanceReviewToFulfillmentDeliverable(
  db: Db,
  input: { adminUserId: number; approvalId: string; clientNoteId: string; payload: unknown }
): Promise<void> {
  const orderId = parseFulfillmentOrderId(input.payload);
  if (!orderId) return;
  const order = await loadOrder(db, orderId, input.adminUserId);
  if (!order) return;
  const [deliverable] = await db
    .select()
    .from(fulfillmentDeliverables)
    .where(eq(fulfillmentDeliverables.orderId, order.id))
    .limit(1);
  if (!deliverable) return;

  await db
    .update(fulfillmentDeliverables)
    .set({ artifactRef: input.clientNoteId, ownerReviewStatus: "pending" })
    .where(eq(fulfillmentDeliverables.id, deliverable.id));

  await insertFulfillmentOrderEvent(db, {
    orderId: order.id,
    actorType: "system",
    actorId: input.approvalId,
    fromStage: order.pipelineStage,
    toStage: "owner_review",
    payloadJson: { clientNoteId: input.clientNoteId, kind: "governance_review_linked" },
  });

  await db
    .update(clientServiceOrders)
    .set({ pipelineStage: "owner_review" })
    .where(eq(clientServiceOrders.id, order.id));
}

export async function recordSmartTrustGovernanceReviewOnOrder(
  db: Db,
  input: { adminUserId: number; approvalId: string; payload: unknown }
): Promise<void> {
  const orderId = parseFulfillmentOrderId(input.payload);
  if (!orderId) return;
  const order = await loadOrder(db, orderId, input.adminUserId);
  if (!order) return;
  const approvedAt = new Date().toISOString();

  await db
    .update(clientServiceOrders)
    .set({
      executiveHandoffJson: mergeSmartTrustFulfillmentHandoff(order.executiveHandoffJson, {
        governanceReviewApprovedAt: approvedAt,
        lastGovernanceReviewApprovalId: input.approvalId,
        trusteeWorkflowState: "trustee_coordination",
      }),
    })
    .where(eq(clientServiceOrders.id, order.id));

  await insertFulfillmentOrderEvent(db, {
    orderId: order.id,
    actorType: "system",
    actorId: input.approvalId,
    fromStage: order.pipelineStage,
    toStage: order.pipelineStage,
    payloadJson: { governanceReviewApprovedAt: approvedAt, trustExecution: "none" },
  });
}

export async function recordSmartTrustResolutionOnOrder(
  db: Db,
  input: { adminUserId: number; approvalId: string; payload: unknown }
): Promise<void> {
  const orderId = parseFulfillmentOrderId(input.payload);
  if (!orderId || !input.payload || typeof input.payload !== "object") return;
  const resolutionId = (input.payload as { resolutionId?: string }).resolutionId?.trim();
  if (!resolutionId) return;

  const order = await loadOrder(db, orderId, input.adminUserId);
  if (!order) return;
  const handoff = parseSmartTrustFulfillmentHandoff(order.executiveHandoffJson);
  const recordedAt = new Date().toISOString();
  const resolutions = markResolutionRecorded(handoff.resolutions, resolutionId, recordedAt);

  await db
    .update(clientServiceOrders)
    .set({
      executiveHandoffJson: mergeSmartTrustFulfillmentHandoff(order.executiveHandoffJson, {
        resolutions,
        lastResolutionRecordApprovalId: input.approvalId,
        trusteeWorkflowState: "resolution_tracking",
      }),
    })
    .where(eq(clientServiceOrders.id, order.id));

  await insertFulfillmentOrderEvent(db, {
    orderId: order.id,
    actorType: "system",
    actorId: input.approvalId,
    fromStage: order.pipelineStage,
    toStage: order.pipelineStage,
    payloadJson: { resolutionId, recordedAt, trustExecution: "none" },
  });
}
