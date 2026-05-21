import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clientNotes,
  clientServiceOrderEvents,
  clientServiceOrders,
  fulfillmentClientDeliveryTokens,
  fulfillmentDeliverables,
} from "@/lib/db/schema";
import {
  auditFulfillmentExecutiveAction,
  insertFulfillmentOrderEvent,
} from "@/lib/fulfillment/fulfillment-audit";
import { buildDraftPreviewText } from "@/lib/fulfillment/fulfillment-deliverable-draft-parse";
import type {
  ClientDeliveryAdminDto,
  ClientDeliveryStatus,
  ClientDeliveryWorkspaceDto,
  DeliveryTimelineEntryDto,
  DeliveryTokenStatus,
  DeliveryTokenSummaryDto,
} from "@/lib/fulfillment/fulfillment-client-delivery-dtos";
import {
  deliveryTokenPrefix,
  generateRawDeliveryToken,
  hashDeliveryToken,
  isDeliveryTokenFormat,
} from "@/lib/fulfillment/fulfillment-delivery-token";
import {
  FULFILLMENT_DEPARTMENT_SITE_BUILDER,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import { loadWebsiteIntakeFromOrder } from "@/lib/fulfillment/website-intake-summary";

type Db = MySql2Database<typeof schema>;

const DEFAULT_EXPIRY_DAYS = 14;
const MAX_EXPIRY_DAYS = 90;
const DELIVERY_EVENT_ACTIONS = new Set([
  "client_delivery_link_generated",
  "client_delivery_link_revoked",
  "client_delivery_workspace_viewed",
  "client_delivery_client_approved",
  "client_delivery_client_revision_requested",
]);

function toIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function workspaceBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  return base.replace(/\/$/, "");
}

export function buildDeliveryWorkspacePath(rawToken: string): string {
  return `/fulfillment-delivery/${encodeURIComponent(rawToken.trim())}`;
}

export function buildDeliveryWorkspaceUrl(rawToken: string): string {
  const base = workspaceBaseUrl();
  const path = buildDeliveryWorkspacePath(rawToken);
  return base ? `${base}${path}` : path;
}

async function loadWebsiteOrderForAdmin(db: Db, orderId: string, adminUserId: number) {
  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, orderId),
        eq(clientServiceOrders.ownerAdminUserId, adminUserId),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_WEBSITE),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_SITE_BUILDER)
      )
    )
    .limit(1);
  return order ?? null;
}

async function loadDeliverable(db: Db, orderId: string) {
  const [row] = await db
    .select()
    .from(fulfillmentDeliverables)
    .where(eq(fulfillmentDeliverables.orderId, orderId))
    .limit(1);
  return row ?? null;
}

function resolveTokenStatus(row: {
  status: string;
  expiresAt: Date;
}): DeliveryTokenStatus {
  if (row.status === "revoked") return "revoked";
  if (row.expiresAt.getTime() <= Date.now()) return "expired";
  return row.status === "active" ? "active" : "expired";
}

function buildDeliveryTimelineFromEvents(
  events: Array<{
    id: string;
    actorType: string;
    payloadJson: string | null;
    createdAt: Date;
  }>
): DeliveryTimelineEntryDto[] {
  const entries: DeliveryTimelineEntryDto[] = [];
  for (const ev of events) {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = ev.payloadJson ? (JSON.parse(ev.payloadJson) as Record<string, unknown>) : null;
    } catch {
      payload = null;
    }
    const action = typeof payload?.action === "string" ? payload.action : null;
    if (!action || !DELIVERY_EVENT_ACTIONS.has(action)) continue;
    const label =
      action === "client_delivery_link_generated"
        ? "Delivery link generated"
        : action === "client_delivery_link_revoked"
          ? "Delivery link revoked"
          : action === "client_delivery_workspace_viewed"
            ? "Client opened workspace"
            : action === "client_delivery_client_approved"
              ? "Client approved draft"
              : action === "client_delivery_client_revision_requested"
                ? "Client requested revision"
                : action;
    entries.push({
      id: ev.id,
      label,
      occurredAt: toIso(ev.createdAt) ?? new Date().toISOString(),
      actorType: ev.actorType,
      detail:
        typeof payload?.revisionNote === "string"
          ? payload.revisionNote.slice(0, 500)
          : typeof payload?.draftVersion === "number"
            ? `Draft v${payload.draftVersion}`
            : null,
    });
  }
  return entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

async function loadDeliveryTimeline(db: Db, orderId: string) {
  const events = await db
    .select({
      id: clientServiceOrderEvents.id,
      actorType: clientServiceOrderEvents.actorType,
      payloadJson: clientServiceOrderEvents.payloadJson,
      createdAt: clientServiceOrderEvents.createdAt,
    })
    .from(clientServiceOrderEvents)
    .where(eq(clientServiceOrderEvents.orderId, orderId))
    .orderBy(desc(clientServiceOrderEvents.createdAt))
    .limit(100);
  return buildDeliveryTimelineFromEvents(events);
}

export async function getClientDeliveryAdminForOrder(
  db: Db,
  input: { orderId: string; adminUserId: number }
): Promise<ClientDeliveryAdminDto | null> {
  const order = await loadWebsiteOrderForAdmin(db, input.orderId, input.adminUserId);
  if (!order) return null;
  const deliverable = await loadDeliverable(db, order.id);
  if (!deliverable) return null;

  const tokenRows = await db
    .select()
    .from(fulfillmentClientDeliveryTokens)
    .where(eq(fulfillmentClientDeliveryTokens.orderId, order.id))
    .orderBy(desc(fulfillmentClientDeliveryTokens.createdAt))
    .limit(20);

  const tokens: DeliveryTokenSummaryDto[] = tokenRows.map((t) => ({
    id: t.id,
    tokenPrefix: t.tokenPrefix,
    draftVersion: t.draftVersion,
    status: resolveTokenStatus({ status: t.status, expiresAt: t.expiresAt }),
    expiresAt: toIso(t.expiresAt) ?? "",
    createdAt: toIso(t.createdAt) ?? "",
    lastAccessedAt: toIso(t.lastAccessedAt),
  }));

  const active = tokens.find((t) => t.status === "active");
  const status = (deliverable.clientDeliveryStatus ?? "not_sent") as ClientDeliveryStatus;

  const canGenerateLink =
    deliverable.ownerReviewStatus === "approved" &&
    order.pipelineStage === "approved_for_release" &&
    Boolean(deliverable.artifactRef?.trim()) &&
    status !== "client_approved";

  return {
    status,
    draftVersion: deliverable.draftVersion ?? 1,
    canGenerateLink,
    activeWorkspaceUrl: null,
    tokens,
    timeline: await loadDeliveryTimeline(db, order.id),
  };
}

export type GenerateDeliveryLinkResult =
  | {
      ok: true;
      tokenId: string;
      workspaceUrl: string;
      expiresAt: string;
      draftVersion: number;
      rawToken: string;
    }
  | { ok: false; httpStatus: number; code: string; message: string };

export async function generateClientDeliveryLink(
  db: Db,
  input: {
    orderId: string;
    adminUserId: number;
    expiresInDays?: number;
    regenerate?: boolean;
  }
): Promise<GenerateDeliveryLinkResult> {
  const order = await loadWebsiteOrderForAdmin(db, input.orderId, input.adminUserId);
  if (!order) {
    return { ok: false, httpStatus: 404, code: "order_not_found", message: "Order not found." };
  }
  const deliverable = await loadDeliverable(db, order.id);
  if (!deliverable?.artifactRef?.trim()) {
    return {
      ok: false,
      httpStatus: 409,
      code: "draft_not_ready",
      message: "Link a Site Builder draft before generating client delivery access.",
    };
  }
  if (
    deliverable.ownerReviewStatus !== "approved" ||
    order.pipelineStage !== "approved_for_release"
  ) {
    return {
      ok: false,
      httpStatus: 409,
      code: "owner_review_required",
      message: "Owner must approve the draft for release before client workspace access.",
    };
  }

  const days = Math.min(
    Math.max(input.expiresInDays ?? DEFAULT_EXPIRY_DAYS, 1),
    MAX_EXPIRY_DAYS
  );
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const rawToken = generateRawDeliveryToken();
  const tokenHash = hashDeliveryToken(rawToken);
  const tokenId = randomUUID();
  const draftVersion = input.regenerate
    ? (deliverable.draftVersion ?? 1) + 1
    : deliverable.draftVersion ?? 1;

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentClientDeliveryTokens)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(fulfillmentClientDeliveryTokens.orderId, order.id),
          eq(fulfillmentClientDeliveryTokens.status, "active")
        )
      );

    await tx.insert(fulfillmentClientDeliveryTokens).values({
      id: tokenId,
      orderId: order.id,
      deliverableId: deliverable.id,
      clientId: order.clientId,
      ownerAdminUserId: input.adminUserId,
      tokenHash,
      tokenPrefix: deliveryTokenPrefix(rawToken),
      draftVersion,
      status: "active",
      expiresAt,
      createdByAdminUserId: input.adminUserId,
    });

    await tx
      .update(fulfillmentDeliverables)
      .set({
        draftVersion,
        clientDeliveryStatus: "workspace_active",
      })
      .where(eq(fulfillmentDeliverables.id, deliverable.id));

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "admin_human",
      actorId: String(input.adminUserId),
      fromStage: order.pipelineStage,
      toStage: order.pipelineStage,
      payloadJson: {
        action: "client_delivery_link_generated",
        tokenId,
        draftVersion,
        expiresAt: expiresAt.toISOString(),
        regenerate: Boolean(input.regenerate),
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.client_delivery.generate_link",
    actionType: "client_delivery_link_generated",
    targetType: "fulfillment_deliverable",
    targetId: deliverable.id,
    inputJson: { orderId: order.id, draftVersion, expiresInDays: days },
    outputJson: { tokenId, tokenPrefix: deliveryTokenPrefix(rawToken) },
  });

  return {
    ok: true,
    tokenId,
    workspaceUrl: buildDeliveryWorkspaceUrl(rawToken),
    expiresAt: expiresAt.toISOString(),
    draftVersion,
    rawToken,
  };
}

export async function revokeClientDeliveryLinks(
  db: Db,
  input: { orderId: string; adminUserId: number }
): Promise<{ ok: true; revoked: number } | { ok: false; httpStatus: number; message: string }> {
  const order = await loadWebsiteOrderForAdmin(db, input.orderId, input.adminUserId);
  if (!order) {
    return { ok: false, httpStatus: 404, message: "Order not found." };
  }

  const active = await db
    .select({ id: fulfillmentClientDeliveryTokens.id })
    .from(fulfillmentClientDeliveryTokens)
    .where(
      and(
        eq(fulfillmentClientDeliveryTokens.orderId, order.id),
        eq(fulfillmentClientDeliveryTokens.status, "active")
      )
    );

  if (!active.length) {
    return { ok: true, revoked: 0 };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentClientDeliveryTokens)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(fulfillmentClientDeliveryTokens.orderId, order.id),
          inArray(
            fulfillmentClientDeliveryTokens.id,
            active.map((a) => a.id)
          )
        )
      );

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "admin_human",
      actorId: String(input.adminUserId),
      fromStage: order.pipelineStage,
      toStage: order.pipelineStage,
      payloadJson: {
        action: "client_delivery_link_revoked",
        revokedCount: active.length,
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: input.adminUserId,
    toolName: "fulfillment.client_delivery.revoke_links",
    actionType: "client_delivery_link_revoked",
    targetType: "client_service_order",
    targetId: order.id,
    inputJson: {},
    outputJson: { revoked: active.length },
  });

  return { ok: true, revoked: active.length };
}

type ResolvedToken = {
  tokenRow: typeof fulfillmentClientDeliveryTokens.$inferSelect;
  order: typeof clientServiceOrders.$inferSelect;
  deliverable: typeof fulfillmentDeliverables.$inferSelect;
};

async function resolveActiveDeliveryToken(
  db: Db,
  rawToken: string
): Promise<ResolvedToken | { error: string; httpStatus: number }> {
  if (!isDeliveryTokenFormat(rawToken)) {
    return { error: "invalid_token", httpStatus: 401 };
  }
  const hash = hashDeliveryToken(rawToken);
  const [tokenRow] = await db
    .select()
    .from(fulfillmentClientDeliveryTokens)
    .where(eq(fulfillmentClientDeliveryTokens.tokenHash, hash))
    .limit(1);
  if (!tokenRow) {
    return { error: "invalid_token", httpStatus: 404 };
  }
  if (tokenRow.status === "revoked") {
    return { error: "token_revoked", httpStatus: 410 };
  }
  if (tokenRow.expiresAt.getTime() <= Date.now()) {
    if (tokenRow.status === "active") {
      await db
        .update(fulfillmentClientDeliveryTokens)
        .set({ status: "expired" })
        .where(eq(fulfillmentClientDeliveryTokens.id, tokenRow.id));
    }
    return { error: "token_expired", httpStatus: 410 };
  }
  if (tokenRow.status !== "active") {
    return { error: "token_inactive", httpStatus: 410 };
  }

  const [order] = await db
    .select()
    .from(clientServiceOrders)
    .where(
      and(
        eq(clientServiceOrders.id, tokenRow.orderId),
        eq(clientServiceOrders.primaryService, FULFILLMENT_PRIMARY_SERVICE_WEBSITE),
        eq(clientServiceOrders.assignedDepartment, FULFILLMENT_DEPARTMENT_SITE_BUILDER)
      )
    )
    .limit(1);
  if (!order) {
    return { error: "order_not_found", httpStatus: 404 };
  }

  const deliverable = await loadDeliverable(db, order.id);
  if (!deliverable || deliverable.id !== tokenRow.deliverableId) {
    return { error: "deliverable_not_found", httpStatus: 404 };
  }

  return { tokenRow, order, deliverable };
}

async function touchTokenAccess(db: Db, tokenId: string) {
  await db
    .update(fulfillmentClientDeliveryTokens)
    .set({ lastAccessedAt: new Date() })
    .where(eq(fulfillmentClientDeliveryTokens.id, tokenId));
}

export async function loadClientDeliveryWorkspace(
  db: Db,
  rawToken: string,
  opts?: { recordView?: boolean }
): Promise<ClientDeliveryWorkspaceDto | { ok: false; code: string; message: string; httpStatus: number }> {
  const resolved = await resolveActiveDeliveryToken(db, rawToken);
  if ("error" in resolved) {
    return { ok: false, code: resolved.error, message: resolved.error, httpStatus: resolved.httpStatus };
  }
  const { tokenRow, order, deliverable } = resolved;

  if (opts?.recordView !== false) {
    await touchTokenAccess(db, tokenRow.id);
    await insertFulfillmentOrderEvent(db, {
      orderId: order.id,
      actorType: "client",
      actorId: "delivery_workspace",
      fromStage: order.pipelineStage,
      toStage: order.pipelineStage,
      payloadJson: {
        action: "client_delivery_workspace_viewed",
        tokenId: tokenRow.id,
        draftVersion: tokenRow.draftVersion,
      },
    });
  }

  const intake = loadWebsiteIntakeFromOrder({
    executiveHandoffJson: order.executiveHandoffJson,
    salesSummaryText: order.salesSummaryText,
    requestedDeliverableJson: order.requestedDeliverableJson,
  });

  let previewText: string | null = null;
  let title: string | null = null;
  let priority: string | null = null;
  if (deliverable.artifactRef) {
    const [note] = await db
      .select({ note: clientNotes.note })
      .from(clientNotes)
      .where(eq(clientNotes.id, deliverable.artifactRef))
      .limit(1);
    if (note) {
      previewText = buildDraftPreviewText(note.note);
      const m = note.note.match(/^Title:\s*(.+)$/m);
      title = m?.[1]?.trim() ?? null;
      const p = note.note.match(/^Priority:\s*(.+)$/m);
      priority = p?.[1]?.trim() ?? null;
    }
  }

  const status = (deliverable.clientDeliveryStatus ?? "workspace_active") as ClientDeliveryStatus;
  const canAct =
    status === "workspace_active" &&
    deliverable.ownerReviewStatus === "approved" &&
    order.pipelineStage === "approved_for_release";

  const businessLines = [
    intake.normalized.businessName,
    intake.normalized.businessType,
    intake.normalized.industry ?? intake.normalized.niche,
  ].filter(Boolean);

  return {
    ok: true,
    draftVersion: tokenRow.draftVersion,
    deliveryStatus: status,
    businessSummary: businessLines.length ? businessLines.join(" · ") : null,
    websiteGoals: intake.normalized.websiteGoals,
    readinessSummary: intake.readiness.missingFields.length
      ? `Coverage: ${intake.readiness.tier} (${intake.readiness.score}/100). Gaps: ${intake.readiness.missingFields.join(", ")}`
      : `Coverage: ${intake.readiness.tier} (${intake.readiness.score}/100).`,
    readinessTier: intake.readiness.tier,
    draftPreview: { title, priority, previewText },
    timeline: await loadDeliveryTimeline(db, order.id),
    canApprove: canAct,
    canRequestRevision: canAct,
    expiresAt: toIso(tokenRow.expiresAt) ?? "",
  };
}

export async function clientApproveDeliveryDraft(
  db: Db,
  rawToken: string
): Promise<
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  const resolved = await resolveActiveDeliveryToken(db, rawToken);
  if ("error" in resolved) {
    return { ok: false, code: resolved.error, message: resolved.error, httpStatus: resolved.httpStatus };
  }
  const { tokenRow, order, deliverable } = resolved;

  if (deliverable.clientDeliveryStatus === "client_approved") {
    return {
      ok: false,
      code: "already_approved",
      message: "Draft already acknowledged.",
      httpStatus: 409,
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentDeliverables)
      .set({ clientDeliveryStatus: "client_approved" })
      .where(eq(fulfillmentDeliverables.id, deliverable.id));

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "client",
      actorId: tokenRow.id,
      fromStage: order.pipelineStage,
      toStage: order.pipelineStage,
      payloadJson: {
        action: "client_delivery_client_approved",
        tokenId: tokenRow.id,
        draftVersion: tokenRow.draftVersion,
        noDeploy: true,
        noEmail: true,
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: order.ownerAdminUserId,
    toolName: "fulfillment.client_delivery.client_approve",
    actionType: "client_delivery_client_approved",
    targetType: "fulfillment_deliverable",
    targetId: deliverable.id,
    inputJson: { orderId: order.id, tokenId: tokenRow.id },
    outputJson: { clientDeliveryStatus: "client_approved" },
  });

  return {
    ok: true,
    message:
      "Thank you — your approval is recorded. The Hero Factory team will handle next steps; nothing is published automatically.",
  };
}

export async function clientRequestDeliveryRevision(
  db: Db,
  rawToken: string,
  revisionNote: string | null
): Promise<
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  const resolved = await resolveActiveDeliveryToken(db, rawToken);
  if ("error" in resolved) {
    return { ok: false, code: resolved.error, message: resolved.error, httpStatus: resolved.httpStatus };
  }
  const { tokenRow, order, deliverable } = resolved;
  const note = revisionNote?.trim().slice(0, 2000) || null;
  const fromStage = order.pipelineStage;

  await db.transaction(async (tx) => {
    await tx
      .update(fulfillmentDeliverables)
      .set({
        clientDeliveryStatus: "client_revision_requested",
        ownerReviewStatus: "rejected",
      })
      .where(eq(fulfillmentDeliverables.id, deliverable.id));

    await tx
      .update(clientServiceOrders)
      .set({ pipelineStage: "service_drafting" })
      .where(eq(clientServiceOrders.id, order.id));

    await tx
      .update(fulfillmentClientDeliveryTokens)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(fulfillmentClientDeliveryTokens.orderId, order.id),
          eq(fulfillmentClientDeliveryTokens.status, "active")
        )
      );

    await insertFulfillmentOrderEvent(tx, {
      orderId: order.id,
      actorType: "client",
      actorId: tokenRow.id,
      fromStage,
      toStage: "service_drafting",
      payloadJson: {
        action: "client_delivery_client_revision_requested",
        tokenId: tokenRow.id,
        draftVersion: tokenRow.draftVersion,
        revisionNote: note,
      },
    });
  });

  await auditFulfillmentExecutiveAction(db, {
    adminUserId: order.ownerAdminUserId,
    toolName: "fulfillment.client_delivery.client_revision",
    actionType: "client_delivery_client_revision_requested",
    targetType: "fulfillment_deliverable",
    targetId: deliverable.id,
    inputJson: { orderId: order.id, revisionNote: note },
    outputJson: { pipelineStage: "service_drafting" },
  });

  return {
    ok: true,
    message: "Revision request received. Your project team will follow up — no changes are published automatically.",
  };
}
