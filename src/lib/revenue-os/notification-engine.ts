/**
 * End-to-end notification run: events → persist → route → deliver.
 */

import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { buildProactiveAutomationGuidance } from "@/lib/revenue-os/proactive-automation-guidance";
import { listAutomationPoliciesForUser } from "@/lib/revenue-os/automation-policies-db";
import {
  buildBentleyNotificationEvents,
  dedupeBentleyNotificationEvents,
} from "@/lib/revenue-os/notification-events";
import { routeBentleyEscalations } from "@/lib/revenue-os/escalation-routing";
import { deliverBentleyNotification } from "@/lib/revenue-os/notification-delivery";
import {
  DEDUPE_LOOKBACK_MS,
  fetchRecentDedupeKeysForUser,
  insertNotificationEvent,
  listNotificationChannelsForUser,
  listNotificationPoliciesForUser,
} from "@/lib/revenue-os/notification-db";

export type RunBentleyNotificationEngineInput = {
  userId: string;
  clientId?: string;
  trustId?: string;
  dryRun?: boolean;
  force?: boolean;
  /** Skip gathering overview if nothing notable (optimization) — still gathers if force. */
  skipIfQuiet?: boolean;
  /** Caller-supplied report flags (e.g. after snapshot) — no duplicate report generation. */
  reportHints?: {
    dailyOperatorReportReady?: boolean;
    weeklyExecutiveReportReady?: boolean;
  };
  digestHeadline?: string | null;
};

export type BentleyNotificationEngineRunSummary = {
  ok: boolean;
  dryRun: boolean;
  eventsBuilt: number;
  eventsPersisted: number;
  eventsDedupedSkipped: number;
  routedCount: number;
  deliveredCount: number;
  failedDeliveryCount: number;
  routingSummary: string;
  skippedRoutingSummary: string;
  noOp: boolean;
  error?: string;
};

export async function runBentleyNotificationEngine(
  input: RunBentleyNotificationEngineInput
): Promise<BentleyNotificationEngineRunSummary> {
  const uid = String(input.userId).trim();
  const dry = Boolean(input.dryRun);
  const nowMs = Date.now();

  if (!uid) {
    return {
      ok: true,
      dryRun: dry,
      eventsBuilt: 0,
      eventsPersisted: 0,
      eventsDedupedSkipped: 0,
      routedCount: 0,
      deliveredCount: 0,
      failedDeliveryCount: 0,
      routingSummary: "no user",
      skippedRoutingSummary: "",
      noOp: true,
    };
  }

  try {
    const filters = {
      clientIds: input.clientId ? [input.clientId] : undefined,
      trustIds: input.trustId ? [input.trustId] : undefined,
    };

    const overview = await buildBentleyOperatorOverview({ userId: uid, ...filters });
    const exceptions = detectBentleyExceptions({ overview });
    const proactive = await buildProactiveAutomationGuidance({ userId: uid, ...filters, overview });
    const autoPolicies = await listAutomationPoliciesForUser({
      userId: uid,
      clientId: input.clientId,
      trustId: input.trustId,
    });

    const built = buildBentleyNotificationEvents({
      userId: uid,
      overview,
      exceptions,
      proactiveGuidance: proactive,
      automationPolicies: autoPolicies.map((p) => ({
        id: p.id,
        policyType: p.policyType,
        nextRunAt: p.nextRunAt,
        isEnabled: p.isEnabled,
      })),
      reportHints: input.reportHints,
      digestHeadline: input.digestHeadline ?? null,
    });

    const existingKeys = await fetchRecentDedupeKeysForUser({
      userId: uid,
      sinceMs: nowMs - DEDUPE_LOOKBACK_MS,
    });
    const deduped = dedupeBentleyNotificationEvents({ events: built, existingDedupeKeys: existingKeys });
    const eventsDedupedSkipped = built.length - deduped.length;

    const quiet = !input.force && input.skipIfQuiet && built.length === 0;

    if (quiet) {
      return {
        ok: true,
        dryRun: dry,
        eventsBuilt: built.length,
        eventsPersisted: 0,
        eventsDedupedSkipped,
        routedCount: 0,
        deliveredCount: 0,
        failedDeliveryCount: 0,
        routingSummary: "skipped quiet",
        skippedRoutingSummary: "",
        noOp: true,
      };
    }

    const policies = await listNotificationPoliciesForUser({
      userId: uid,
      clientId: input.clientId,
      trustId: input.trustId,
    });
    const channels = await listNotificationChannelsForUser(uid);

    const routed = routeBentleyEscalations({
      events: deduped,
      policies,
      channels,
    });

    const eventIdByDedupe = new Map<string, string>();
    let eventsPersisted = 0;

    if (!dry) {
      for (const d of deduped) {
        const ins = await insertNotificationEvent({
          userId: uid,
          clientId: d.scope.clientId,
          trustId: d.scope.trustId,
          sourceType: d.sourceType,
          eventType: d.eventType,
          severity: d.severity,
          title: d.title,
          body: d.body,
          eventPayloadJson: d.eventPayloadJson,
          dedupeKey: d.dedupeKey,
        });
        if (ins.ok) {
          eventIdByDedupe.set(d.dedupeKey, ins.id);
          eventsPersisted++;
        }
      }
    }

    let deliveredCount = 0;
    let failedDeliveryCount = 0;

    for (const intent of routed.routedDeliveries) {
      const dk = intent.eventDraft.dedupeKey;
      const eventId = dry ? `dry-${dk.slice(0, 32)}` : eventIdByDedupe.get(dk);
      if (!dry && !eventId) {
        failedDeliveryCount++;
        continue;
      }
      try {
        const res = await deliverBentleyNotification({
          userId: uid,
          eventId: eventId ?? `dry-${dk}`,
          channel: intent.channel,
          draft: intent.eventDraft,
          dryRun: dry,
        });
        if (res.ok && (res.deliveryStatus === "sent" || res.deliveryStatus === "skipped")) {
          deliveredCount++;
        } else {
          failedDeliveryCount++;
        }
      } catch {
        failedDeliveryCount++;
      }
    }

    return {
      ok: true,
      dryRun: dry,
      eventsBuilt: built.length,
      eventsPersisted,
      eventsDedupedSkipped,
      routedCount: routed.routedDeliveries.length,
      deliveredCount,
      failedDeliveryCount,
      routingSummary: routed.routingSummary,
      skippedRoutingSummary: `${routed.skippedDeliveries.length} skipped`,
      noOp: deduped.length === 0 && routed.routedDeliveries.length === 0,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      dryRun: dry,
      eventsBuilt: 0,
      eventsPersisted: 0,
      eventsDedupedSkipped: 0,
      routedCount: 0,
      deliveredCount: 0,
      failedDeliveryCount: 0,
      routingSummary: "error",
      skippedRoutingSummary: "",
      noOp: true,
      error: err,
    };
  }
}
