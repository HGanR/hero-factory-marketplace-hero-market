/**
 * Channel delivery abstraction (in-app DB, email/webhook placeholders).
 */

import type { NotificationChannelRow } from "@/lib/revenue-os/notification-db";
import type { BentleyNotificationEventDraft } from "@/lib/revenue-os/notification-events";
import { insertNotificationDelivery } from "@/lib/revenue-os/notification-db";

export type DeliverBentleyNotificationInput = {
  userId: string;
  eventId: string;
  channel: NotificationChannelRow;
  draft: BentleyNotificationEventDraft;
  dryRun: boolean;
};

export type DeliverBentleyNotificationResult = {
  ok: boolean;
  deliveryId?: string;
  deliveryStatus: "pending" | "sent" | "failed" | "skipped";
  mock?: boolean;
  payloadPreview?: Record<string, unknown>;
  error?: string;
};

function buildPayload(draft: BentleyNotificationEventDraft, channel: NotificationChannelRow): Record<string, unknown> {
  return {
    title: draft.title,
    body: draft.body,
    eventType: draft.eventType,
    severity: draft.severity,
    scope: draft.scope,
    recommendedAction: draft.recommendedAction,
    deepLinkHints: draft.deepLinkHints,
    channelType: channel.channelType,
    channelLabel: channel.channelLabel,
  };
}

/**
 * Single delivery attempt — persists delivery row unless dryRun.
 */
export async function deliverBentleyNotification(input: DeliverBentleyNotificationInput): Promise<DeliverBentleyNotificationResult> {
  const { eventId, channel, draft, dryRun } = input;
  const payload = buildPayload(draft, channel);
  const ct = channel.channelType;

  if (dryRun) {
    return {
      ok: true,
      deliveryStatus: "skipped",
      mock: true,
      payloadPreview: { channelType: ct, ...payload },
    };
  }

  try {
    if (ct === "in_app") {
      const ins = await insertNotificationDelivery({
        eventId,
        channelId: channel.id,
        deliveryStatus: "sent",
        deliveryAttemptCount: 1,
        deliveredAt: new Date(),
        deliveryPayloadJson: payload,
      });
      return {
        ok: ins.ok,
        deliveryId: ins.id,
        deliveryStatus: ins.ok ? "sent" : "failed",
      };
    }

    if (ct === "email" || ct === "email_placeholder") {
      const ins = await insertNotificationDelivery({
        eventId,
        channelId: channel.id,
        deliveryStatus: "sent",
        deliveryAttemptCount: 1,
        deliveredAt: new Date(),
        deliveryPayloadJson: {
          ...payload,
          mockEmail: true,
          note: "Email transport not wired — delivery recorded as sent (placeholder).",
        },
      });
      return {
        ok: ins.ok,
        deliveryId: ins.id,
        deliveryStatus: "sent",
        mock: true,
      };
    }

    if (ct === "webhook" || ct === "webhook_placeholder" || ct === "slack_placeholder") {
      const ins = await insertNotificationDelivery({
        eventId,
        channelId: channel.id,
        deliveryStatus: "sent",
        deliveryAttemptCount: 1,
        deliveredAt: new Date(),
        deliveryPayloadJson: {
          ...payload,
          mockWebhook: true,
          note: "Webhook not invoked — placeholder record only.",
        },
      });
      return {
        ok: ins.ok,
        deliveryId: ins.id,
        deliveryStatus: "sent",
        mock: true,
      };
    }

    const ins = await insertNotificationDelivery({
      eventId,
      channelId: channel.id,
      deliveryStatus: "skipped",
      deliveryAttemptCount: 0,
      deliveryPayloadJson: { ...payload, reason: "unknown_channel_type" },
    });
    return {
      ok: ins.ok,
      deliveryId: ins.id,
      deliveryStatus: "skipped",
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, deliveryStatus: "failed", error: err };
  }
}

export type DeliverBentleyNotificationsBatchInput = {
  items: Array<{
    eventId: string;
    channel: NotificationChannelRow;
    draft: BentleyNotificationEventDraft;
  }>;
  userId: string;
  dryRun: boolean;
};

export type DeliverBentleyNotificationsBatchResult = {
  results: DeliverBentleyNotificationResult[];
  failedCount: number;
};

export async function deliverBentleyNotificationsBatch(
  input: DeliverBentleyNotificationsBatchInput
): Promise<DeliverBentleyNotificationsBatchResult> {
  const results: DeliverBentleyNotificationResult[] = [];
  let failedCount = 0;
  for (const item of input.items) {
    try {
      const r = await deliverBentleyNotification({
        userId: input.userId,
        eventId: item.eventId,
        channel: item.channel,
        draft: item.draft,
        dryRun: input.dryRun,
      });
      results.push(r);
      if (!r.ok || r.deliveryStatus === "failed") failedCount++;
    } catch (e) {
      failedCount++;
      results.push({
        ok: false,
        deliveryStatus: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { results, failedCount };
}
