/**
 * Launch readiness scoring for scheduled broadcast events (planning layer only; never auto-starts).
 */

import type { BroadcastEvent } from "./broadcast-events";

export type BroadcastLaunchReadinessStatus = "ready" | "attention_needed" | "blocked";

export type BroadcastLaunchCheckKey =
  | "room_assigned"
  | "scheduled_start"
  | "scene_strategy"
  | "timeline_template"
  | "show_package"
  | "calendar_link"
  | "destinations"
  | "live_session_conflict"
  | "prepare_launch";

export type BroadcastLaunchCheckItemStatus = "ok" | "attention" | "blocked";

export type BroadcastLaunchReadinessCheck = {
  key: BroadcastLaunchCheckKey;
  status: BroadcastLaunchCheckItemStatus;
  summary: string;
  detail?: string;
};

export type BroadcastLaunchReadinessReport = {
  broadcastEventId: number;
  overallStatus: BroadcastLaunchReadinessStatus;
  checks: BroadcastLaunchReadinessCheck[];
  computedAtIso: string;
};

export type BuildBroadcastLaunchReadinessInput = {
  event: BroadcastEvent;
  /** Result of `prepareBroadcastEventLaunch` for this event. */
  prepareResult: { ok: true } | { ok: false; errors: string[] };
  /** From successful prepare — linked or default show package used for defaults; null if none. */
  appliedShowPackageId: number | null;
  /** Count of active `stream_destinations` for the host. */
  activeDestinationCount: number;
  /** Whether a calendar link row exists for this event. */
  hasCalendarLink: boolean;
  /** Live session in same room linked to a different broadcast event. */
  conflictingLiveSessionId: number | null;
  /** From `resolveBroadcastStartScene` — preset applied vs default path. */
  sceneUsedPreset: boolean;
  /** Warnings from scene resolution (e.g. missing preset id). */
  sceneResolveWarnings: string[];
};

export function validateLaunchReadinessInputs(userId: number, broadcastEventId: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(userId) || userId <= 0) return { ok: false, error: "invalid_user" };
  if (!Number.isFinite(broadcastEventId) || broadcastEventId <= 0) return { ok: false, error: "invalid_broadcast_event_id" };
  return { ok: true };
}

export function buildBroadcastLaunchReadinessReport(input: BuildBroadcastLaunchReadinessInput, computedAtIso: string): BroadcastLaunchReadinessReport {
  const { event } = input;
  const checks: BroadcastLaunchReadinessCheck[] = [];

  const room = event.roomId?.trim() ?? "";
  if (!room) {
    checks.push({
      key: "room_assigned",
      status: "blocked",
      summary: "Room not assigned",
      detail: "Set a meet room on the broadcast event before launch.",
    });
  } else {
    checks.push({
      key: "room_assigned",
      status: "ok",
      summary: "Room assigned",
      detail: room,
    });
  }

  if (event.scheduledStartIso?.trim()) {
    checks.push({
      key: "scheduled_start",
      status: "ok",
      summary: "Scheduled start set",
      detail: event.scheduledStartIso,
    });
  } else {
    checks.push({
      key: "scheduled_start",
      status: "blocked",
      summary: "Missing scheduled start",
    });
  }

  if (event.scenePresetId != null && Number.isFinite(Number(event.scenePresetId))) {
    const sceneFatal = input.sceneResolveWarnings.some((w) => /scene_resolve_failed|invalid/i.test(w));
    if (sceneFatal) {
      checks.push({
        key: "scene_strategy",
        status: "blocked",
        summary: "Scene could not be resolved",
        detail: input.sceneResolveWarnings.join("; "),
      });
    } else if (input.sceneUsedPreset) {
      checks.push({
        key: "scene_strategy",
        status: "ok",
        summary: "Scene preset resolved",
      });
    } else if (input.sceneResolveWarnings.length) {
      checks.push({
        key: "scene_strategy",
        status: "attention",
        summary: "Scene preset not applied",
        detail: input.sceneResolveWarnings.join("; ") || "Default program scene will be used.",
      });
    } else {
      checks.push({
        key: "scene_strategy",
        status: "attention",
        summary: "Scene preset not applied",
        detail: "Default program scene will be used.",
      });
    }
  } else {
    checks.push({
      key: "scene_strategy",
      status: "ok",
      summary: "Default scene strategy",
      detail: "No preset — standard program defaults apply.",
    });
  }

  if (event.defaultTimelineTemplateId != null) {
    if (input.prepareResult.ok) {
      checks.push({
        key: "timeline_template",
        status: "ok",
        summary: "Timeline template resolved",
      });
    } else if (input.prepareResult.errors.includes("timeline_template_not_found")) {
      checks.push({
        key: "timeline_template",
        status: "blocked",
        summary: "Timeline template missing or invalid",
        detail: "Fix or clear default timeline template on the event.",
      });
    } else {
      checks.push({
        key: "timeline_template",
        status: "attention",
        summary: "Timeline template not verified (prepare-launch did not succeed)",
        detail: input.prepareResult.errors.join(", ") || undefined,
      });
    }
  } else {
    checks.push({
      key: "timeline_template",
      status: "ok",
      summary: "No timeline template",
      detail: "Explicit no-template path is acceptable.",
    });
  }

  if (input.prepareResult.ok && input.appliedShowPackageId != null) {
    checks.push({
      key: "show_package",
      status: "ok",
      summary: "Show package defaults available",
      detail: `Package id ${input.appliedShowPackageId}`,
    });
  } else if (input.prepareResult.ok) {
    checks.push({
      key: "show_package",
      status: "attention",
      summary: "No show package defaults",
      detail: "Link a show package on the event or set an account default package for bundled launch defaults.",
    });
  } else {
    checks.push({
      key: "show_package",
      status: "attention",
      summary: "Show package not evaluated",
      detail: "Prepare-launch did not succeed; fix errors above first.",
    });
  }

  checks.push({
    key: "calendar_link",
    status: "ok",
    summary: input.hasCalendarLink ? "Calendar linked" : "No calendar link",
    detail: input.hasCalendarLink ? "Informational — not required to go live." : "Optional — link from the calendar panel if desired.",
  });

  if (input.activeDestinationCount <= 0) {
    checks.push({
      key: "destinations",
      status: "attention",
      summary: "No active stream destinations",
      detail: "Add at least one active destination before you can broadcast.",
    });
  } else {
    checks.push({
      key: "destinations",
      status: "ok",
      summary: "Active destinations available",
      detail: `${input.activeDestinationCount} active`,
    });
  }

  if (input.conflictingLiveSessionId != null) {
    checks.push({
      key: "live_session_conflict",
      status: "blocked",
      summary: "Another event is live in this room",
      detail: `Session ${input.conflictingLiveSessionId} is linked to a different broadcast event.`,
    });
  } else {
    checks.push({
      key: "live_session_conflict",
      status: "ok",
      summary: "No conflicting linked live session",
    });
  }

  if (input.prepareResult.ok) {
    checks.push({
      key: "prepare_launch",
      status: "ok",
      summary: "Prepare-launch resolution succeeded",
    });
  } else {
    checks.push({
      key: "prepare_launch",
      status: "blocked",
      summary: "Prepare-launch failed",
      detail: input.prepareResult.errors.join(", "),
    });
  }

  let overallStatus: BroadcastLaunchReadinessStatus = "ready";
  for (const c of checks) {
    if (c.status === "blocked") {
      overallStatus = "blocked";
      break;
    }
  }
  if (overallStatus !== "blocked") {
    for (const c of checks) {
      if (c.status === "attention") {
        overallStatus = "attention_needed";
        break;
      }
    }
  }

  return {
    broadcastEventId: event.id,
    overallStatus,
    checks,
    computedAtIso,
  };
}

export function summarizeBroadcastLaunchReadiness(report: BroadcastLaunchReadinessReport): string {
  if (report.overallStatus === "ready") return "Ready to prepare launch";
  if (report.overallStatus === "attention_needed") return "Attention needed before launch";
  return "Blocked — fix issues before launch";
}
