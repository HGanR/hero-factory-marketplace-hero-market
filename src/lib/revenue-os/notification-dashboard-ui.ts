/**
 * UI-ready notification + escalation payloads.
 */

import {
  countUnreadInAppDeliveriesForUser,
  listNotificationChannelsForUser,
  listNotificationDeliveriesForUser,
  listNotificationEventsForUser,
  listNotificationPoliciesForUser,
} from "@/lib/revenue-os/notification-db";
import type { BentleyNotificationEngineRunSummary } from "@/lib/revenue-os/notification-engine";
import type { NotificationEscalationGuidance } from "@/lib/revenue-os/market-sweep-schema";

export type { NotificationEscalationGuidance };

export type NotificationDashboardUiPayload = {
  unreadInApp: Array<{
    deliveryId: string;
    eventId: string;
    title: string;
    body: string;
    severity: string;
    createdAt: string | null;
  }>;
  criticalEscalations: Array<{ eventId: string; title: string; severity: string; createdAt: string | null }>;
  deliveryFailures: Array<{ deliveryId: string; eventId: string; error: string | null }>;
  eventTimeline: Array<{
    id: string;
    eventType: string;
    severity: string;
    title: string;
    createdAt: string | null;
  }>;
  policyCoverage: Array<{
    id: string;
    eventType: string;
    channelId: string;
    minimumSeverity: string;
    isEnabled: boolean;
  }>;
  channelStatus: Array<{
    id: string;
    channelType: string;
    channelLabel: string;
    isEnabled: boolean;
  }>;
  dedupeSuppressionSummary: string;
  generatedAt: string;
};

export async function buildNotificationEscalationGuidance(input: {
  userId: string;
  lastEngineRun?: BentleyNotificationEngineRunSummary | null;
}): Promise<NotificationEscalationGuidance> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      bentleyNotificationSummaryLine: "Sign in for notification state.",
    };
  }

  const unread = await countUnreadInAppDeliveriesForUser(uid);
  const events = await listNotificationEventsForUser({ userId: uid, limit: 40 });
  const critical = events.filter((e) => e.severity === "critical").length;

  const lastRun = input.lastEngineRun;
  const lastLine = lastRun
    ? `Last run: ${lastRun.eventsPersisted} event(s), ${lastRun.deliveredCount} delivered, ${lastRun.noOp ? "no-op" : "active"}.`
    : undefined;

  const top = events.find((e) => e.severity === "critical") ?? events[0];
  const topLine = top
    ? `Latest: ${top.title.slice(0, 120)}`
    : undefined;

  return {
    bentleyNotificationSummaryLine: `${unread} unread in-app; ${critical} critical event(s) in recent timeline.`,
    bentleyCriticalEscalationCount: critical,
    bentleyUnreadInAppCount: unread,
    bentleyLastNotificationRunLine: lastLine,
    bentleyTopEscalationTargetLine: topLine,
  };
}

export async function buildNotificationDashboardUiPayload(input: {
  userId: string;
  generatedAt: string;
}): Promise<NotificationDashboardUiPayload> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      unreadInApp: [],
      criticalEscalations: [],
      deliveryFailures: [],
      eventTimeline: [],
      policyCoverage: [],
      channelStatus: [],
      dedupeSuppressionSummary: "No user",
      generatedAt: input.generatedAt,
    };
  }

  const [channels, policies, events, deliveries] = await Promise.all([
    listNotificationChannelsForUser(uid),
    listNotificationPoliciesForUser({ userId: uid }),
    listNotificationEventsForUser({ userId: uid, limit: 60 }),
    listNotificationDeliveriesForUser({ userId: uid, limit: 80 }),
  ]);

  const inAppChannelIds = new Set(channels.filter((c) => c.channelType === "in_app").map((c) => c.id));
  const eventById = new Map(events.map((e) => [e.id, e]));

  const unreadInApp: NotificationDashboardUiPayload["unreadInApp"] = [];
  for (const d of deliveries) {
    if (d.deliveryStatus !== "sent" || d.readAt != null) continue;
    if (!inAppChannelIds.has(d.channelId)) continue;
    const ev = eventById.get(d.eventId);
    if (!ev) continue;
    unreadInApp.push({
      deliveryId: d.id,
      eventId: d.eventId,
      title: ev.title,
      body: ev.body ?? "",
      severity: ev.severity,
      createdAt: ev.createdAt?.toISOString() ?? null,
    });
  }

  const criticalEscalations = events
    .filter((e) => e.severity === "critical")
    .slice(0, 12)
    .map((e) => ({
      eventId: e.id,
      title: e.title,
      severity: e.severity,
      createdAt: e.createdAt?.toISOString() ?? null,
    }));

  const deliveryFailures = deliveries
    .filter((d) => d.deliveryStatus === "failed")
    .slice(0, 20)
    .map((d) => ({
      deliveryId: d.id,
      eventId: d.eventId,
      error: d.lastDeliveryError ?? null,
    }));

  const eventTimeline = events.slice(0, 40).map((e) => ({
    id: e.id,
    eventType: e.eventType,
    severity: e.severity,
    title: e.title,
    createdAt: e.createdAt?.toISOString() ?? null,
  }));

  return {
    unreadInApp: unreadInApp.slice(0, 30),
    criticalEscalations,
    deliveryFailures,
    eventTimeline,
    policyCoverage: policies.map((p) => ({
      id: p.id,
      eventType: p.eventType,
      channelId: p.channelId,
      minimumSeverity: p.minimumSeverity,
      isEnabled: p.isEnabled,
    })),
    channelStatus: channels.map((c) => ({
      id: c.id,
      channelType: c.channelType,
      channelLabel: c.channelLabel,
      isEnabled: c.isEnabled,
    })),
    dedupeSuppressionSummary: "Recent duplicate keys suppressed within 24h lookback.",
    generatedAt: input.generatedAt,
  };
}

export function mergeNotificationEscalationIntoGrowthGuidance(
  base: import("@/lib/revenue-os/market-sweep-schema").GrowthGuidance,
  escalation: NotificationEscalationGuidance
): import("@/lib/revenue-os/market-sweep-schema").GrowthGuidance {
  return {
    ...base,
    bentleyNotificationSummaryLine: escalation.bentleyNotificationSummaryLine,
    bentleyCriticalEscalationCount: escalation.bentleyCriticalEscalationCount,
    bentleyUnreadInAppCount: escalation.bentleyUnreadInAppCount,
    bentleyLastNotificationRunLine: escalation.bentleyLastNotificationRunLine,
    bentleyTopEscalationTargetLine: escalation.bentleyTopEscalationTargetLine,
  };
}
