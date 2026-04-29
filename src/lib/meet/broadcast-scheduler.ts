import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { broadcastAudit } from "./broadcast-audit";
import {
  incrementBroadcastScheduleActionExecute,
  incrementBroadcastScheduleActionFail,
} from "./broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "./broadcast-live-scenes";
import {
  applyCountdownAutomationAction,
  applyScheduledActionToLiveState,
  applyScheduledActionToOverlayState,
  getDueScheduledActions,
  type BroadcastScheduledAction,
  type BroadcastScheduleState,
} from "./broadcast-schedule";
import {
  ensureBroadcastScheduleStateForSession,
  upsertBroadcastScheduleState,
} from "./broadcast-schedule-store";
import {
  ensureBroadcastLiveSceneStateForSession,
  resetBroadcastLiveSceneStateToProgram,
  upsertBroadcastLiveSceneState,
} from "./broadcast-live-scene-store";
import { ensureBroadcastOverlayStateForSession, upsertBroadcastOverlayState } from "./broadcast-overlay-store";
import { publishScheduleActionExecuted, publishScheduleActionFailed } from "./broadcast-event-publisher";
import { publishBroadcastTimelineEventSafe } from "./broadcast-timeline-publisher";

export type MeetBroadcastSessionRow = typeof meetBroadcastSessions.$inferSelect;

function markActionExecuted(
  schedule: BroadcastScheduleState,
  action: BroadcastScheduledAction,
  nowIso: string,
  actorUserId: number
): BroadcastScheduleState {
  return {
    ...schedule,
    actions: schedule.actions.map((a) => (a.id === action.id ? { ...a, executedAtIso: nowIso } : a)),
    lastExecutedActionId: action.id,
    updatedAt: nowIso,
    updatedByUserId: actorUserId,
  };
}

async function executeOneScheduledAction(
  session: MeetBroadcastSessionRow,
  schedule: BroadcastScheduleState,
  action: BroadcastScheduledAction,
  nowIso: string,
  actorUserId: number
): Promise<{ ok: true; schedule: BroadcastScheduleState } | { ok: false; error: string; schedule: BroadcastScheduleState }> {
  try {
    switch (action.actionType) {
      case "switch_scene": {
        const live = await ensureBroadcastLiveSceneStateForSession(session);
        const applied = applyScheduledActionToLiveState(live, action, actorUserId);
        if (!applied.ok) {
          return { ok: false, error: applied.errors.join("; "), schedule };
        }
        await upsertBroadcastLiveSceneState({
          ...applied.state,
          updatedAt: nowIso,
          updatedByUserId: actorUserId,
        });
        return { ok: true, schedule: markActionExecuted(schedule, action, nowIso, actorUserId) };
      }
      case "reset_scene_to_program": {
        await resetBroadcastLiveSceneStateToProgram(session.id);
        return { ok: true, schedule: markActionExecuted(schedule, action, nowIso, actorUserId) };
      }
      case "show_overlay":
      case "hide_overlay":
      case "update_overlay": {
        const overlay = await ensureBroadcastOverlayStateForSession(session);
        const applied = applyScheduledActionToOverlayState(overlay, action, actorUserId);
        if (!applied.ok) {
          return { ok: false, error: applied.errors.join("; "), schedule };
        }
        await upsertBroadcastOverlayState({
          ...applied.state,
          updatedAt: nowIso,
          updatedByUserId: actorUserId,
        });
        return { ok: true, schedule: markActionExecuted(schedule, action, nowIso, actorUserId) };
      }
      case "start_countdown":
      case "stop_countdown": {
        const cd = applyCountdownAutomationAction(schedule, action, nowIso, actorUserId);
        if (!cd.ok) {
          return { ok: false, error: cd.errors.join("; "), schedule };
        }
        return { ok: true, schedule: markActionExecuted(cd.state, action, nowIso, actorUserId) };
      }
      default:
        return { ok: false, error: "unknown actionType", schedule };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 400) : "unknown",
      schedule,
    };
  }
}

/**
 * Runs due scheduled actions for an active V2 rendered session (polling-driven). No egress restart.
 * Persists schedule row only when at least one action succeeds.
 */
export async function evaluateBroadcastScheduleForActiveSession(
  session: MeetBroadcastSessionRow,
  nowIso: string
): Promise<{ schedule: BroadcastScheduleState; executedCount: number }> {
  if (!isV2LiveSceneControlAvailable(session)) {
    const schedule = await ensureBroadcastScheduleStateForSession(session);
    return { schedule, executedCount: 0 };
  }

  let schedule = await ensureBroadcastScheduleStateForSession(session);
  if (!schedule.automationEnabled) {
    return { schedule, executedCount: 0 };
  }

  const due = getDueScheduledActions(schedule, nowIso);
  if (due.length === 0) {
    return { schedule, executedCount: 0 };
  }

  const actorUserId = session.userId;
  let executedCount = 0;

  for (const action of due) {
    const res = await executeOneScheduledAction(session, schedule, action, nowIso, actorUserId);
    if (res.ok) {
      schedule = res.schedule;
      executedCount++;
      broadcastAudit("broadcast_schedule_action_executed", {
        broadcastSessionId: session.id,
        userId: actorUserId,
        actionId: action.id,
        actionType: action.actionType,
      });
      incrementBroadcastScheduleActionExecute({
        userId: actorUserId,
        sessionId: session.id,
        reason: action.actionType,
      });
      publishScheduleActionExecuted(session.id, session.roomId, action.id, action.actionType);
      publishBroadcastTimelineEventSafe({
        broadcastSessionId: session.id,
        userId: actorUserId,
        eventType: "schedule_action_executed",
        summary: String(action.actionType).replace(/_/g, " "),
        detailsJson: { actionId: action.id, actionType: action.actionType },
      });
    } else {
      broadcastAudit("broadcast_schedule_action_failed", {
        broadcastSessionId: session.id,
        userId: actorUserId,
        actionId: action.id,
        actionType: action.actionType,
        errorSummary: res.error.slice(0, 200),
      });
      incrementBroadcastScheduleActionFail({
        userId: actorUserId,
        sessionId: session.id,
        reason: action.actionType,
      });
      publishScheduleActionFailed(session.id, session.roomId, action.id, action.actionType);
      publishBroadcastTimelineEventSafe({
        broadcastSessionId: session.id,
        userId: actorUserId,
        eventType: "note",
        summary: "Schedule action failed",
        detailsJson: {
          actionId: action.id,
          actionType: action.actionType,
          errorSummary: res.error.slice(0, 200),
        },
      });
    }
  }

  if (executedCount > 0) {
    await upsertBroadcastScheduleState(schedule);
  }

  return { schedule, executedCount };
}

export async function evaluateBroadcastScheduleForSession(
  broadcastSessionId: number,
  nowIso: string
): Promise<{ schedule: BroadcastScheduleState | null; executedCount: number }> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, broadcastSessionId))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return { schedule: null, executedCount: 0 };
  }
  const r = await evaluateBroadcastScheduleForActiveSession(session, nowIso);
  return { schedule: r.schedule, executedCount: r.executedCount };
}
