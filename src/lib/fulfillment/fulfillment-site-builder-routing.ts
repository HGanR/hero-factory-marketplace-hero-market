import "server-only";

import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientServiceOrderEvents,
  clientServiceOrders,
  executiveAgentApprovals,
  fulfillmentDeliverables,
} from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { CreateSiteBuilderTaskPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import {
  buildSiteBuilderTaskPayloadFromOrder,
  ProposeSiteBuilderDraftBodySchema,
} from "@/lib/fulfillment/fulfillment-site-builder-payload";
import { collectRevisionNotesFromEvents } from "@/lib/fulfillment/revision-intelligence";
import {
  FULFILLMENT_ARTIFACT_SITE_BUILDER_PACKAGE,
  FULFILLMENT_DEPARTMENT_SITE_BUILDER,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export { ProposeSiteBuilderDraftBodySchema } from "@/lib/fulfillment/fulfillment-site-builder-payload";

type Db = MySql2Database<typeof schema>;

const SITE_BUILDER_ACTION = "createSiteBuilderTask";
const ORDER_TARGET_TYPE = "client_service_order";
const ROUTING_STAGE = "service_drafting";

export type ProposeSiteBuilderDraftResult =
  | {
      ok: true;
      approvalId: string;
      orderId: string;
      pipelineStage: string;
      message: string;
    }
  | { ok: false; httpStatus: number; code: string; message: string; approvalId?: string };

async function findPendingSiteBuilderApproval(
  db: Db,
  input: { adminUserId: number; orderId: string }
): Promise<string | null> {
  const [row] = await db
    .select({ id: executiveAgentApprovals.id })
    .from(executiveAgentApprovals)
    .where(
      and(
        eq(executiveAgentApprovals.adminUserId, input.adminUserId),
        eq(executiveAgentApprovals.proposedAction, SITE_BUILDER_ACTION),
        eq(executiveAgentApprovals.targetType, ORDER_TARGET_TYPE),
        eq(executiveAgentApprovals.targetId, input.orderId),
        eq(executiveAgentApprovals.status, "pending")
      )
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * Queues `createSiteBuilderTask` via the existing executive approval system.
 * Executor writes an internal client note only — no deploy, email, or release.
 */
export async function proposeSiteBuilderDraftFromFulfillmentOrder(
  db: Db,
  input: {
    adminUserId: number;
    orderId: string;
    body?: unknown;
  }
): Promise<ProposeSiteBuilderDraftResult> {
  const parsedBody = ProposeSiteBuilderDraftBodySchema.safeParse(input.body ?? {});
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
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_WEBSITE),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_SITE_BUILDER)
      )
    )
    .limit(1);

  if (!order) {
    return {
      ok: false,
      httpStatus: 404,
      code: "order_not_found",
      message: "WEBSITE fulfillment order not found for this admin desk.",
    };
  }

  if (order.pipelineStage === "released" || order.pipelineStage === "closed") {
    return {
      ok: false,
      httpStatus: 409,
      code: "order_closed",
      message: "Cannot propose Site Builder draft for a released or closed order.",
    };
  }

  const existingPending = await findPendingSiteBuilderApproval(db, {
    adminUserId: input.adminUserId,
    orderId: order.id,
  });
  if (existingPending) {
    return {
      ok: false,
      httpStatus: 409,
      code: "approval_already_pending",
      message: "A pending Site Builder task approval already exists for this order.",
      approvalId: existingPending,
    };
  }

  const eventRows = await db
    .select({ payloadJson: clientServiceOrderEvents.payloadJson })
    .from(clientServiceOrderEvents)
    .where(eq(clientServiceOrderEvents.orderId, order.id))
    .limit(50);

  const [deliverable] = await db
    .select({ draftVersion: fulfillmentDeliverables.draftVersion })
    .from(fulfillmentDeliverables)
    .where(eq(fulfillmentDeliverables.orderId, order.id))
    .limit(1);

  const revisionNotes = collectRevisionNotesFromEvents(eventRows);
  const baseVersion = deliverable?.draftVersion ?? 1;
  const draftVersion =
    revisionNotes.length > 0 && order.pipelineStage === "service_drafting"
      ? baseVersion + 1
      : baseVersion;

  const payload = buildSiteBuilderTaskPayloadFromOrder(order, parsedBody.data, {
    revisionNotes,
    draftVersion: Math.max(1, draftVersion),
  });
  const payloadValidated = CreateSiteBuilderTaskPayloadSchema.safeParse(payload);
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
    proposedAction: SITE_BUILDER_ACTION,
    targetType: ORDER_TARGET_TYPE,
    targetId: order.id,
    payloadJson: JSON.stringify({
      ...payloadValidated.data,
      fulfillmentOrderId: order.id,
      artifactType: FULFILLMENT_ARTIFACT_SITE_BUILDER_PACKAGE,
    }).slice(0, 100_000),
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
      proposedAction: SITE_BUILDER_ACTION,
      deliverableRouting: "site_builder_draft_only",
    },
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: SITE_BUILDER_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({
      orderId: order.id,
      clientId: order.clientId,
      pipelineStage: ROUTING_STAGE,
    }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.propose_site_builder_draft",
    actionType: "site_builder_draft_proposed",
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
      "Site Builder draft queued for executive approval. Approve via existing approvals UI — internal note only, no deploy or send.",
  };
}
