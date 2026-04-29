/**
 * Fire-and-forget timeline writes. Append failures must never break primary broadcast actions.
 * Layering: metrics = counters; audit = security/ops trail; timeline = session narrative for operators.
 */

import { broadcastAudit } from "./broadcast-audit";
import type { BroadcastTimelineAppendInput } from "./broadcast-timeline";
import { appendBroadcastTimelineEvent } from "./broadcast-timeline-store";

export function publishBroadcastTimelineEventSafe(input: BroadcastTimelineAppendInput): void {
  void (async () => {
    try {
      const r = await appendBroadcastTimelineEvent(input);
      if (!r.ok) {
        broadcastAudit("broadcast_timeline_append_rejected", {
          broadcastSessionId: input.broadcastSessionId,
          userId: input.userId,
          eventType: String(input.eventType),
          errorSummary: r.errors.join("|").slice(0, 200),
        });
      }
    } catch (e) {
      broadcastAudit("broadcast_timeline_append_failed", {
        broadcastSessionId: input.broadcastSessionId,
        userId: input.userId,
        eventType: String(input.eventType),
        errorSummary: (e instanceof Error ? e.message : "unknown").slice(0, 200),
      });
    }
  })();
}
