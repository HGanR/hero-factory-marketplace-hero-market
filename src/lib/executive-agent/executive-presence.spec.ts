import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveExecutiveUrgency,
  deriveOperationalEmotion,
  deriveOperationalOrbState,
  deriveToneMode,
  mapOrbStateToVisualMode,
  rankInterruptions,
} from "@/lib/executive-agent/executive-presence-engine";
import { buildExecutivePresenceInterruptions } from "@/lib/executive-agent/executive-presence-interruptions";
import {
  composeExecutivePresenceGreeting,
  isVoiceAcknowledgementRequest,
  isVoiceInterruptDuringBriefing,
  pacingHintForUrgency,
} from "@/lib/executive-agent/executive-presence-voice";
import { buildExecutiveSessionTimeline } from "@/lib/executive-agent/executive-session-timeline";
import type { ExecutivePresenceSnapshot } from "@/lib/executive-agent/executive-presence-types";

describe("executive-presence-engine", () => {
  it("derives urgency and orb state from desk signals", () => {
    const base = {
      crisisLevel: "watch",
      pendingApprovals: 0,
      criticalAlerts: 0,
      escalationSurge: false,
      eventCount: 0,
      kpiDriftScore: 0,
      stalledOrders: 0,
      workflowPausedCount: 0,
      workflowAtRiskCount: 0,
      topIncidentTitle: null,
      topIncidentSeverity: null,
    };
    assert.equal(deriveExecutiveUrgency(base), "routine");
    assert.equal(deriveOperationalOrbState("routine", base), "idle");

    const urgent = { ...base, crisisLevel: "high", criticalAlerts: 1 };
    assert.equal(deriveExecutiveUrgency(urgent), "urgent");
    assert.equal(deriveToneMode("urgent", "high"), "operations_director");
    assert.equal(deriveOperationalEmotion("urgent", urgent), "concerned");
  });

  it("maps operational orb states to visual modes when voice is idle", () => {
    assert.equal(mapOrbStateToVisualMode("incident", null), "alert");
    assert.equal(mapOrbStateToVisualMode("strategic_analysis", null), "processing");
    assert.equal(mapOrbStateToVisualMode("monitoring", "listening"), "listening");
  });
});

describe("executive-presence-interruptions", () => {
  it("builds governed advisory interruptions", () => {
    const items = buildExecutivePresenceInterruptions({
      topIncident: { title: "Stalled TRUST order", severity: "high", summary: "Dwell 12d" },
      topAlerts: [],
      pendingApprovals: 3,
      escalationSurge: true,
      campaignDegradation: true,
      campaignDegradationDetail: "Bentley friction",
      workflowAtRisk: [],
      workflowPaused: [],
      operatorOverload: [],
    });
    assert.ok(items.some((i) => i.kind === "approval_backlog"));
    assert.ok(items.every((i) => i.advisoryOnly === true));
    const ranked = rankInterruptions(items);
    assert.equal(ranked[0]?.severity, "high");
  });
});

describe("executive-presence-voice", () => {
  it("composes chief-of-staff greeting with posture and recommendation", () => {
    const partial: Pick<
      ExecutivePresenceSnapshot,
      | "toneMode"
      | "urgency"
      | "postureHeadline"
      | "criticalRisks"
      | "activeIncidents"
      | "workflowBottlenecks"
      | "topRecommendedAction"
      | "activeEntities"
      | "sessionContinuity"
    > = {
      toneMode: "chief_of_staff",
      urgency: "elevated",
      postureHeadline: "Elevated watch on the desk.",
      criticalRisks: ["Approval backlog"],
      activeIncidents: ["TRUST stall"],
      workflowBottlenecks: ["Cross-dept handoff"],
      topRecommendedAction: "Review approval queue",
      activeEntities: [{ id: "bentley", label: "Bentley", role: "bentley", status: "online", lastSignal: null }],
      sessionContinuity: {
        lastCheckInAt: "2026-01-01T00:00:00.000Z",
        sessionsSinceLastCheckIn: 1,
        preferenceNotes: [],
        priorityPatterns: [],
      },
    };
    const spoken = composeExecutivePresenceGreeting(partial);
    assert.match(spoken, /Boss/);
    assert.match(spoken, /Elevated watch/);
    assert.match(spoken, /Review approval queue/);
    assert.match(spoken, /Bentley/);
  });

  it("detects voice acknowledgements and interrupts", () => {
    assert.equal(isVoiceAcknowledgementRequest("ok"), true);
    assert.equal(isVoiceInterruptDuringBriefing("hold on"), true);
    assert.equal(pacingHintForUrgency("critical"), "urgent");
  });
});

describe("executive-session-timeline", () => {
  it("records deltas since last checkpoint", () => {
    const timeline = buildExecutiveSessionTimeline({
      now: "2026-05-23T00:00:00.000Z",
      lastCheckpoint: {
        id: "x",
        checkedInAt: "2026-05-22T00:00:00.000Z",
        postureSummary: "steady",
        orbState: "monitoring",
        urgency: "routine",
        pendingApprovals: 1,
        openIncidents: 0,
        topAction: null,
      },
      incidents: ["New incident"],
      newEscalations: [],
      approvalDelta: 2,
      resolvedSinceLast: [],
      operatorShifts: [],
      workflowChanges: [],
      sessionNote: null,
    });
    assert.ok(timeline.some((t) => t.category === "approval" && t.deltaSinceLastSession));
  });
});
