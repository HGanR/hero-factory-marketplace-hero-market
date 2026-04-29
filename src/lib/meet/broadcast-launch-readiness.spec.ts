/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildBroadcastLaunchReadinessReport,
  summarizeBroadcastLaunchReadiness,
  validateLaunchReadinessInputs,
} from "./broadcast-launch-readiness";
import type { BroadcastEvent } from "./broadcast-events";

function ev(p: Partial<BroadcastEvent>): BroadcastEvent {
  return {
    id: 1,
    userId: 1,
    title: "Show",
    description: null,
    scheduledStartIso: "2026-05-01T18:00:00.000Z",
    scheduledEndIso: null,
    timezone: null,
    roomId: "room-a",
    status: "scheduled",
    scenePresetId: null,
    defaultTimelineTemplateId: null,
    showPackageId: null,
    createdAtIso: "2026-01-01T00:00:00.000Z",
    updatedAtIso: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("broadcast-launch-readiness", () => {
  it("validateLaunchReadinessInputs", () => {
    expect(validateLaunchReadinessInputs(1, 1).ok).toBe(true);
    expect(validateLaunchReadinessInputs(0, 1).ok).toBe(false);
    expect(validateLaunchReadinessInputs(1, NaN).ok).toBe(false);
  });

  it("buildBroadcastLaunchReadinessReport ready path", () => {
    const report = buildBroadcastLaunchReadinessReport(
      {
        event: ev({}),
        prepareResult: { ok: true },
        appliedShowPackageId: 1,
        activeDestinationCount: 2,
        hasCalendarLink: false,
        conflictingLiveSessionId: null,
        sceneUsedPreset: false,
        sceneResolveWarnings: [],
      },
      "2026-04-01T00:00:00.000Z"
    );
    expect(report.overallStatus).toBe("ready");
    expect(summarizeBroadcastLaunchReadiness(report)).toContain("Ready");
  });

  it("attention when prepare ok but no show package defaults", () => {
    const report = buildBroadcastLaunchReadinessReport(
      {
        event: ev({}),
        prepareResult: { ok: true },
        appliedShowPackageId: null,
        activeDestinationCount: 2,
        hasCalendarLink: false,
        conflictingLiveSessionId: null,
        sceneUsedPreset: false,
        sceneResolveWarnings: [],
      },
      "2026-04-01T00:00:00.000Z"
    );
    expect(report.overallStatus).toBe("attention_needed");
    expect(report.checks.some((c) => c.key === "show_package" && c.status === "attention")).toBe(true);
  });

  it("blocked without room", () => {
    const report = buildBroadcastLaunchReadinessReport(
      {
        event: ev({ roomId: null }),
        prepareResult: { ok: false, errors: ["event_room_required"] },
        appliedShowPackageId: null,
        activeDestinationCount: 0,
        hasCalendarLink: false,
        conflictingLiveSessionId: null,
        sceneUsedPreset: false,
        sceneResolveWarnings: [],
      },
      "2026-04-01T00:00:00.000Z"
    );
    expect(report.overallStatus).toBe("blocked");
  });

  it("attention when no destinations", () => {
    const report = buildBroadcastLaunchReadinessReport(
      {
        event: ev({}),
        prepareResult: { ok: true },
        appliedShowPackageId: 1,
        activeDestinationCount: 0,
        hasCalendarLink: false,
        conflictingLiveSessionId: null,
        sceneUsedPreset: false,
        sceneResolveWarnings: [],
      },
      "2026-04-01T00:00:00.000Z"
    );
    expect(report.overallStatus).toBe("attention_needed");
  });

  it("blocked on live session conflict", () => {
    const report = buildBroadcastLaunchReadinessReport(
      {
        event: ev({}),
        prepareResult: { ok: true },
        appliedShowPackageId: 1,
        activeDestinationCount: 2,
        hasCalendarLink: false,
        conflictingLiveSessionId: 99,
        sceneUsedPreset: false,
        sceneResolveWarnings: [],
      },
      "2026-04-01T00:00:00.000Z"
    );
    expect(report.overallStatus).toBe("blocked");
  });
});
