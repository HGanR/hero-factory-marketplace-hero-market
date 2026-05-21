import "server-only";

import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clientServiceOrders, executiveAgentApprovals } from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { CreateTrustFulfillmentPacketPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import {
  buildTrustFulfillmentPacketPayloadFromOrder,
  ProposeTrustPacketBodySchema,
} from "@/lib/fulfillment/fulfillment-trust-packet-payload";
import {
  FULFILLMENT_DEPARTMENT_TRUST_RECORDS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
} from "@/lib/fulfillment/fulfillment-types";

export { ProposeTrustPacketBodySchema } from "@/lib/fulfillment/fulfillment-trust-packet-payload";

type Db = MySql2Database<typeof schema>;

const TRUST_PACKET_ACTION = "createTrustFulfillmentPacket";
const ORDER_TARGET_TYPE = "client_service_order";
const ROUTING_STAGE = "service_drafting";

export type ProposeTrustPacketResult =
  | { ok: true; approvalId: string; orderId: string; pipelineStage: string; message: string }
  | { ok: false; httpStatus: number; code: string; message: string; approvalId?: string };

async function findPendingTrustPacketApproval(
  db: Db,
  input: { adminUserId: number; orderId: string }
): Promise<string | null> {
  const [row] = await db
    .select({ id: executiveAgentApprovals.id })
    .from(executiveAgentApprovals)
    .where(
      and(
        eq(executiveAgentApprovals.adminUserId, input.adminUserId),
        eq(executiveAgentApprovals.proposedAction, TRUST_PACKET_ACTION),
        eq(executiveAgentApprovals.targetType, ORDER_TARGET_TYPE),
        eq(executiveAgentApprovals.targetId, input.orderId),
        eq(executiveAgentApprovals.status, "pending")
      )
    )
    .limit(1);
  return row?.id ?? null;
}

export async function proposeTrustPacketFromFulfillmentOrder(
  db: Db,
  input: { adminUserId: number; orderId: string; body?: unknown }
): Promise<ProposeTrustPacketResult> {
  const parsedBody = ProposeTrustPacketBodySchema.safeParse(input.body ?? {});
  if (!parsedBody.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: parsedBody.error.issues.map((i) => i.message).join("; "),
    };
  }

  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, input.orderId),
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

  if (order.pipelineStage === "released" || order.pipelineStage === "closed") {
    return {
      ok: false,
      httpStatus: 409,
      code: "order_closed",
      message: "Cannot propose trust packet for a released or closed order.",
    };
  }

  const existingPending = await findPendingTrustPacketApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
  });
  if (existingPending) {
    return {
      ok: false,
      httpStatus: 409,
      code: "approval_already_pending",
      message: "A pending trust packet approval already exists for this order.",
      approvalId: existingPending,
    };
  }

  const payload = buildTrustFulfillmentPacketPayloadFromOrder(order, parsedBody.data);
  const payloadValidated = CreateTrustFulfillmentPacketPayloadSchema.safeParse(payload);
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
    proposedAction: TRUST_PACKET_ACTION,
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    payloadJson: JSON.stringify(payloadValidated.data).slice(0, 100_000),
  });

  await db
    .update(clientServiceOrders)
    .set({ pipelineStage: ROUTING_STAGE })
    .where(eq(clientServiceOrders.id, order.id));

  await insertFulfillmentOrderEvent(db, {
    orderId: order.id,
    actorType: "admin_human",
    actorId: String(input.adminUserId),
    fromStage,
    toStage: ROUTING_STAGE,
    payloadJson: {
      approvalId,
      proposedAction: TRUST_PACKET_ACTION,
      deliverableRouting: "trust_packet_only",
      artifactType: payloadValidated.data.deliverableType,
    },
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: TRUST_PACKET_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ orderId: order.id, clientId: order.clientId }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.propose_trust_packet",
    actionType: "trust_packet_proposed",
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    inputJson: { approvalId, clientId: order.clientId },
    outputJson: { pipelineStage: ROUTING_STAGE },
  });

  return {
    ok: true,
    approvalId,
    orderId: order.id,
    pipelineStage: ROUTING_STAGE,
    message:
      "Trust packet queued for executive approval. Approve via approvals UI — internal legal-review note only.",
  };
}
