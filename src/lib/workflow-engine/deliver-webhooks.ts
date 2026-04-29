/**
 * Webhook Delivery - POST to subscriber URLs when platform events occur
 * Headers: X-Webhook-Event, X-Webhook-Delivery-Id, X-Webhook-Timestamp, X-Webhook-Signature
 * X-Webhook-Signature: sha256=<hex> (HMAC-SHA256 of raw body with secret)
 */

import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { developerWebhooks, trusts } from "@/lib/db/schema";

export type WebhookEventType =
  | "certificate_issued"
  | "instrument_issued"
  | "collateral_pledged"
  | "proceeds_received"
  | "accounting_event_processed"
  | "world_draft_saved"
  | "world_published"
  | "commerce_node_created"
  | "commerce_transaction"
  | "app_published"
  | "app_installed"
  | "asset_purchased";

const ACCOUNTING_TO_WEBHOOK: Record<string, WebhookEventType> = {
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

export interface WebhookPayload {
  event: WebhookEventType;
  payload: Record<string, unknown>;
  timestamp: string;
  deliveryId: string;
}

async function resolveUserId(trustId: string | undefined): Promise<number | null> {
  if (!trustId) return null;
  const db = await getDb();
  const [row] = await db.select({ userId: trusts.userId }).from(trusts).where(eq(trusts.id, trustId)).limit(1);
  return row?.userId ?? null;
}

/**
 * Deliver webhooks for an event. Call from same places as runWorkflowsForEvent.
 */
export async function deliverWebhooksForEvent(
  event: WebhookEventType,
  payload: Record<string, unknown>,
  userId?: number
): Promise<void> {
  let resolvedUserId = userId;
  if (resolvedUserId == null) {
    resolvedUserId = (await resolveUserId(payload.trustId as string)) ?? undefined;
  }
  if (resolvedUserId == null) return;

  const db = await getDb();
  const hooks = await db
    .select()
    .from(developerWebhooks)
    .where(
      and(
        eq(developerWebhooks.userId, resolvedUserId),
        eq(developerWebhooks.isActive, true)
      )
    );

  const eventStr = event;
  const matchingHooks = hooks.filter((h) => {
    const events = typeof h.events === "string" ? JSON.parse(h.events || "[]") : h.events;
    return Array.isArray(events) && events.includes(eventStr);
  });

  const timestamp = new Date().toISOString();

  for (const hook of matchingHooks) {
    const deliveryId = crypto.randomUUID();
    const body: WebhookPayload = {
      event: eventStr,
      payload,
      timestamp,
      deliveryId,
    };
    const bodyStr = JSON.stringify(body);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": eventStr,
      "X-Webhook-Delivery-Id": deliveryId,
      "X-Webhook-Timestamp": timestamp,
    };
    // HMAC-SHA256 signature (Stripe-style) - only if we have raw secret (new webhooks store raw; legacy stored hash)
    const signingSecret = hook.secret;
    const isRawSecret = signingSecret && !/^[a-f0-9]{64}$/.test(signingSecret);
    if (isRawSecret) {
      const sig = crypto.createHmac("sha256", signingSecret).update(bodyStr).digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${sig}`;
    }
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers,
        body: bodyStr,
      });
      await db
        .update(developerWebhooks)
        .set({
          lastTriggeredAt: new Date(),
          lastStatus: res.status,
        })
        .where(eq(developerWebhooks.id, hook.id));
    } catch {
      await db
        .update(developerWebhooks)
        .set({
          lastTriggeredAt: new Date(),
          lastStatus: 0,
        })
        .where(eq(developerWebhooks.id, hook.id));
    }
  }
}

/**
 * Map accounting event type to webhook event and deliver.
 */
export async function deliverWebhooksForAccountingEvent(
  sourceEventType: string,
  payload: Record<string, unknown>,
  userId?: number
): Promise<void> {
  const event = ACCOUNTING_TO_WEBHOOK[sourceEventType] ?? "accounting_event_processed";
  const enriched = { ...payload, sourceEventType };
  await deliverWebhooksForEvent(event, enriched, userId);
}
