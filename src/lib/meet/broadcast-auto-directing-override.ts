/**
 * Record manual operator layout changes — pauses auto-apply via persisted override window.
 */

import { broadcastAudit } from "./broadcast-audit";
import { defaultManualOverrideUntilIso } from "./broadcast-auto-directing";
import { incrementBroadcastAutoDirectingPauseManualOverride } from "./broadcast-metrics";
import { ensureBroadcastAutoDirectingStateForSession, upsertBroadcastAutoDirectingState } from "./broadcast-auto-directing-store";
import { publishBroadcastTimelineEventSafe } from "./broadcast-timeline-publisher";

export { BROADCAST_AUTO_DIRECTING_MANUAL_OVERRIDE_DEFAULT_MS, isManualAutoDirectingOverrideActive } from "./broadcast-auto-directing";

/** Fire-and-forget safe: never throws to callers. */
export async function recordOperatorManualLayoutOverride(
  broadcastSessionId: number,
  userId: number,
  roomId: string
): Promise<void> {
  try {
    const now = new Date();
    const st = await ensureBroadcastAutoDirectingStateForSession(broadcastSessionId, userId);
    const until = defaultManualOverrideUntilIso(now);
    await upsertBroadcastAutoDirectingState({
      broadcastSessionId,
      userId,
      state: { ...st, manualOverrideUntilIso: until, updatedByUserId: userId },
    });
    incrementBroadcastAutoDirectingPauseManualOverride({ userId, roomId, sessionId: broadcastSessionId, reason: "layout" });
    broadcastAudit("broadcast_auto_directing_manual_override", {
      broadcastSessionId,
      userId,
      roomId,
      untilIso: until,
    });
    publishBroadcastTimelineEventSafe({
      broadcastSessionId,
      userId,
      eventType: "auto_directing_manual_override",
      summary: "Manual layout — auto-apply paused",
      detailsJson: { untilIso: until },
    });
  } catch {
    /* ignore */
  }
}
