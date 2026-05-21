import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientNotes,
  clientServiceOrders,
  fulfillmentDeliverables,
} from "@/lib/db/schema";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import {
  buildDraftPreviewText,
  parseFulfillmentOrderIdFromPayload,
  parseSiteBuilderNoteFields,
} from "@/lib/fulfillment/fulfillment-deliverable-draft-parse";

export {
  buildDraftPreviewText,
  parseFulfillmentOrderIdFromPayload,
  parseSiteBuilderNoteFields,
} from "@/lib/fulfillment/fulfillment-deliverable-draft-parse";
import {
  FULFILLMENT_DEPARTMENT_SITE_BUILDER,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

type Db = MySql2Database<typeof schema>;

import type { FulfillmentDeliverableDraftDto } from "@/lib/fulfillment/fulfillment-deliverable-draft-dtos";

export type { FulfillmentDeliverableDraftDto } from "@/lib/fulfillment/fulfillment-deliverable-draft-dtos";

const SITE_BUILDER_NOTE_MARKER = "[Site Builder — approved task]";

export type DeliverableReviewResult =
  | { ok: true; pipelineStage: string; ownerReviewStatus: string; message: string }
  | { ok: false; httpStatus: number; code: string; message: string };

async function loadWebsiteOrderForAdmin(
  db: Db,
  input: { orderId: string; adminUserId: number }
) {
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
  return order ?? null;
}

async function loadDeliverableForOrder(db: Db, orderId: string) {
  const [row] = await db
    .select()
    .from(fulfillmentDeliverables)
    .where(eq(fulfillmentDeliverables.orderId, orderId))
    .limit(1);
  return row ?? null;
}

async function findLatestSiteBuilderDraftNote(db: Db, clientId: string) {
  const rows = await db
    .select({
      id: clientNotes.id,
      note: clientNotes.note,
      createdAt: clientNotes.createdAt,
    })
    .from(clientNotes)
    .where(and(eq(clientNotes.clientId, clientId), eq(clientNotes.visibility, "internal")))
    .orderBy(desc(clientNotes.createdAt))
    .limit(20);

  return rows.find((r) => r.note.includes(SITE_BUILDER_NOTE_MARKER)) ?? null;
}

/**
 * After createSiteBuilderTask executes, link internal note → deliverable.artifactRef.
 */
export async function linkSiteBuilderDraftToFulfillmentDeliverable(
  db: Db,
  input: {
    adminUserId: number;
    approvalId: string;
    clientNoteId: string;
    payload: unknown;
  }
): Promise<void> {
  const orderId = parseFulfillmentOrderIdFromPayload(input.payload);
  if (!orderId) return;

  const order = await loadWebsiteOrderForAdmin(db, { orderId, adminUserId: input.adminUserId });
  if (!order) return;

  const deliverable = await loadDeliverableForOrder(db, order.id);
  if (!deliverable) return;

  const fromStage = order.pipelineStage;

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentDeliverables)
      .set({
        artifactRef: input.clientNoteId,
        ownerReviewStatus: "pending",
      })
      .where(eq(fulfillmentDeliverables.id, deliverable.id));

    await tx
      .update(clientServiceOrders)
      .set({ pipelineStage: "owner_review" })
      .where(eq(clientServiceOrders.id, order.id));

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "system",
      actorId: input.approvalId,
      fromStage,
      toStage: "owner_review",
      payloadJson: {
        deliverableId: deliverable.id,
        clientNoteId: input.clientNoteId,
        approvalId: input.approvalId,
        action: "site_builder_draft_linked",
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.deliverable.link_draft",
    actionType: "site_builder_draft_linked",
    targetType: "fulfillment_deliverable",
    targetId: deliverable.id,
    inputJson: { orderId: order.id, approvalId: input.approvalId, clientNoteId: input.clientNoteId },
    outputJson: { ownerReviewStatus: "pending", pipelineStage: "owner_review" },
  });
}

export async function loadDeliverableDraftForOrder(
  db: Db,
  input: { orderId: string; adminUserId: number }
): Promise<FulfillmentDeliverableDraftDto | null> {
  const order = await loadWebsiteOrderForAdmin(db, input);
  if (!order) return null;

  const deliverable = await loadDeliverableForOrder(db, order.id);
  if (!deliverable) return null;

  let noteId = deliverable.artifactRef?.trim() || null;
  let noteRow: { id: string; note: string } | null = null;

  if (noteId) {
    const [n] = await db
      .select({ id: clientNotes.id, note: clientNotes.note })
      .from(clientNotes)
      .where(and(eq(clientNotes.id, noteId), eq(clientNotes.clientId, order.clientId)))
      .limit(1);
    noteRow = n ?? null;
  }

  if (!noteRow) {
    const fallback = await findLatestSiteBuilderDraftNote(db, order.clientId);
    if (fallback) {
      noteRow = fallback;
      noteId = fallback.id;
    }
  }

  const linked = Boolean(noteRow);
  const parsed = noteRow ? parseSiteBuilderNoteFields(noteRow.note) : null;
  const ownerReviewStatus = deliverable.ownerReviewStatus;
  const pipelineStage = order.pipelineStage;

  const canReview =
    linked &&
    ownerReviewStatus === "pending" &&
    pipelineStage === "owner_review";

  return {
    linked,
    clientNoteId: noteId,
    title: parsed?.title ?? null,
    priority: parsed?.priority ?? null,
    previewText: noteRow ? buildDraftPreviewText(noteRow.note) : null,
    ownerReviewStatus,
    pipelineStage,
    canApprove: canReview,
    canRequestRevision: canReview,
    clientDeliveryStatus:
      ownerReviewStatus === "approved" && pipelineStage === "approved_for_release"
        ? "approved_for_release"
        : "not_sent",
  };
}

export async function approveDeliverableDraftForRelease(
  db: Db,
  input: { orderId: string; adminUserId: number }
): Promise<DeliverableReviewResult> {
  const order = await loadWebsiteOrderForAdmin(db, input);
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "Order not found." };
  }

  const deliverable = await loadDeliverableForOrder(db, order.id);
  if (!deliverable?.artifactRef?.trim()) {
    return {
      ok: false,
      httpStatus: 409,
      code: "draft_not_linked",
      message: "No Site Builder draft is linked for owner review yet.",
    };
  }

  if (deliverable.ownerReviewStatus !== "pending") {
    return {
      ok: false,
      httpStatus: 409,
      code: "invalid_review_state",
      message: `Deliverable is already ${deliverable.ownerReviewStatus}.`,
    };
  }

  const fromStage = order.pipelineStage;

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentDeliverables)
      .set({ ownerReviewStatus: "approved" })
      .where(eq(fulfillmentDeliverables.id, deliverable.id));

    await tx
      .update(clientServiceOrders)
      .set({ pipelineStage: "approved_for_release" })
      .where(eq(clientServiceOrders.id, order.id));

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "admin_human",
      actorId: String(input.adminUserId),
      fromStage,
      toStage: "approved_for_release",
      payloadJson: {
        deliverableId: deliverable.id,
        clientNoteId: deliverable.artifactRef,
        action: "deliverable_approved_for_release",
        clientDelivery: "not_sent",
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.deliverable.approve_draft",
    actionType: "deliverable_approved_for_release",
    targetType: "fulfillment_deliverable",
    targetId: deliverable.id,
    inputJson: { orderId: order.id },
    outputJson: { ownerReviewStatus: "approved", pipelineStage: "approved_for_release" },
  });

  return {
    ok: true,
    pipelineStage: "approved_for_release",
    ownerReviewStatus: "approved",
    message:
      "Draft approved for release internally. No email, deploy, or client delivery in v1.",
  };
}

export async function requestDeliverableRevision(
  db: Db,
  input: { orderId: string; adminUserId: number; revisionNote?: string | null }
): Promise<DeliverableReviewResult> {
  const order = await loadWebsiteOrderForAdmin(db, input);
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "Order not found." };
  }

  const deliverable = await loadDeliverableForOrder(db, order.id);
  if (!deliverable?.artifactRef?.trim()) {
    return {
      ok: false,
      httpStatus: 409,
      code: "draft_not_linked",
      message: "No Site Builder draft is linked for revision.",
    };
  }

  if (deliverable.ownerReviewStatus !== "pending") {
    return {
      ok: false,
      httpStatus: 409,
      code: "invalid_review_state",
      message: `Deliverable is already ${deliverable.ownerReviewStatus}.`,
    };
  }

  const fromStage = order.pipelineStage;
  const note = input.revisionNote?.trim().slice(0, 2000) || null;

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentDeliverables)
      .set({ ownerReviewStatus: "rejected" })
      .where(eq(fulfillmentDeliverables.id, deliverable.id));

    await tx
      .update(clientServiceOrders)
      .set({ pipelineStage: "service_drafting" })
      .where(eq(clientServiceOrders.id, order.id));

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "admin_human",
      actorId: String(input.adminUserId),
      fromStage,
      toStage: "service_drafting",
      payloadJson: {
        deliverableId: deliverable.id,
        clientNoteId: deliverable.artifactRef,
        action: "deliverable_revision_requested",
        revisionNote: note,
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.deliverable.request_revision",
    actionType: "deliverable_revision_requested",
    targetType: "fulfillment_deliverable",
    targetId: deliverable.id,
    inputJson: { orderId: order.id, revisionNote: note },
    outputJson: { ownerReviewStatus: "rejected", pipelineStage: "service_drafting" },
  });

  return {
    ok: true,
    pipelineStage: "service_drafting",
    ownerReviewStatus: "rejected",
    message: "Revision requested. Propose a new Site Builder draft when ready — no client send.",
  };
}
