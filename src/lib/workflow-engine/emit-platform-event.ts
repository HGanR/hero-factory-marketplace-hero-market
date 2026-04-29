/**
 * Central platform event emission.
 * Logs to activity stream, runs workflows, delivers webhooks.
 */

import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformActivity, trusts } from "@/lib/db/schema";
import { runWorkflowsForEvent } from "./execute";
import { deliverWebhooksForEvent } from "./deliver-webhooks";
import { updateGraphFromEvent } from "@/lib/graph/update-graph";
import type { WorkflowTriggerEvent } from "./execute";
import type { WebhookEventType } from "./deliver-webhooks";

const ACCOUNTING_TO_TRIGGER: Record<string, WorkflowTriggerEvent> = {
  INSTRUMENT_ISSUED: "instrument_issued",
  COLLATERAL_PLEDGED: "collateral_pledged",
  PROCEEDS_RECEIVED: "proceeds_received",
  INTEREST_ACCRUED: "accounting_event_processed",
  INTEREST_PAID: "accounting_event_processed",
  BROKERAGE_DEPOSIT_INITIATED: "accounting_event_processed",
  BROKERAGE_DEPOSIT_COMPLETED: "accounting_event_processed",
  BROKER_FEE_INCURRED: "accounting_event_processed",
  VALUATION_UPDATED: "accounting_event_processed",
  ASSET_IMPAIRMENT_RECORDED: "accounting_event_processed",
  INSTRUMENT_REDEEMED: "accounting_event_processed",
  INSTRUMENT_DEFAULTED: "accounting_event_processed",
  LIABILITY_CREATED: "accounting_event_processed",
  LIABILITY_REDUCED: "accounting_event_processed",
  FEE_EXPENSE: "accounting_event_processed",
};

async function resolveUserId(trustId: string | undefined): Promise<number | null> {
  if (!trustId) return null;
  const db = await getDb();
  const [row] = await db.select({ userId: trusts.userId }).from(trusts).where(eq(trusts.id, trustId)).limit(1);
  return row?.userId ?? null;
}

const TRIGGER_TO_WEBHOOK: Record<WorkflowTriggerEvent, WebhookEventType> = {
  certificate_issued: "certificate_issued",
  instrument_issued: "instrument_issued",
  collateral_pledged: "collateral_pledged",
  proceeds_received: "proceeds_received",
  entity_created: "accounting_event_processed",
  accounting_event_processed: "accounting_event_processed",
  world_draft_saved: "world_draft_saved",
  world_published: "world_published",
  commerce_node_created: "commerce_node_created",
  commerce_transaction: "commerce_transaction",
  app_published: "app_published",
  app_installed: "app_installed",
  asset_purchased: "asset_purchased",
};

const SOURCE_MODULES: Record<WorkflowTriggerEvent, string> = {
  certificate_issued: "Securities",
  instrument_issued: "Trust Records",
  collateral_pledged: "Trust Records",
  proceeds_received: "Trust Records",
  entity_created: "Entity Builder",
  accounting_event_processed: "Accounting",
  world_draft_saved: "Worlds",
  world_published: "Worlds",
  commerce_node_created: "World Commerce",
  commerce_transaction: "World Commerce",
  app_published: "Creator Marketplace",
  app_installed: "Creator Marketplace",
  asset_purchased: "Asset Marketplace",
};

export interface EmitPayload {
  trustId?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

/**
 * Emit a platform event: log to activity stream, run workflows, deliver webhooks.
 */
export async function emitPlatformEvent(
  triggerEvent: WorkflowTriggerEvent,
  payload: EmitPayload,
  userId?: number
): Promise<void> {
  const resolvedUserId = userId ?? (await resolveUserId(payload.trustId as string));
  if (resolvedUserId == null) return;

  const db = await getDb();
  const id = uuidv4();

  try {
    await db.insert(platformActivity).values({
      id,
      userId: resolvedUserId,
      eventType: triggerEvent,
      sourceModule: SOURCE_MODULES[triggerEvent],
      payload: payload as Record<string, unknown>,
      trustId: payload.trustId as string | undefined ?? null,
    });
  } catch {
    // Don't fail if activity log fails
  }

  try {
    const webhookEvent = TRIGGER_TO_WEBHOOK[triggerEvent];
    await Promise.all([
      runWorkflowsForEvent(triggerEvent, payload, resolvedUserId),
      deliverWebhooksForEvent(webhookEvent, payload, resolvedUserId),
    ]);
  } catch {
    // Don't fail caller if workflows/webhooks fail
  }

  try {
    await updateGraphFromEvent(triggerEvent, payload, resolvedUserId);
  } catch {
    // Don't fail caller if graph update fails
  }
}

/**
 * Emit an accounting event (from event inbox processing).
 * Maps source event type to trigger, logs, runs workflows, delivers webhooks.
 */
export async function emitAccountingPlatformEvent(
  sourceEventType: string,
  payload: EmitPayload,
  userId?: number
): Promise<void> {
  const triggerEvent = ACCOUNTING_TO_TRIGGER[sourceEventType] ?? "accounting_event_processed";
  const enrichedPayload: EmitPayload = { ...payload, sourceEventType };
  await emitPlatformEvent(triggerEvent, enrichedPayload, userId);
}
