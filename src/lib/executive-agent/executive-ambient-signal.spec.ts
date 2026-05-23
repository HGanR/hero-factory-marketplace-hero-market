import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAmbientInterruptions,
} from "@/lib/executive-agent/ambient-interruption-engine";
import { deriveAmbientOrbState } from "@/lib/executive-agent/ambient-orb-state-engine";
import type { AmbientExecutiveSignal } from "@/lib/executive-agent/executive-ambient-signal-types";
import { buildExecutiveOperationalFeed } from "@/lib/executive-agent/executive-operational-feed";
import { buildAmbientVoiceBriefing, narrateAmbientSignal } from "@/lib/executive-agent/executive-signal-narration";
import {
  dominantSeverity,
  meetsInterruptionThreshold,
  rankAmbientSignals,
  scoreExecutiveRelevance,
} from "@/lib/executive-agent/executive-signal-ranking";
import { EXECUTIVE_SIGNAL_GOVERNANCE } from "@/lib/executive-agent/executive-ambient-signal-types";
import {
  deriveOperationalPresenceMode,
  PRESENCE_MODE_LABEL,
} from "@/lib/executive-agent/operational-presence-state";

function sampleSignal(partial: Partial<AmbientExecutiveSignal> & Pick<AmbientExecutiveSignal, "id" | "category" | "severity" | "summary" | "occurredAt">): AmbientExecutiveSignal {
  const narration = narrateAmbientSignal({
    category: partial.category,
    severity: partial.severity,
    summary: partial.summary,
  });
  return {
    id: partial.id,
    category: partial.category,
    severity: partial.severity,
    summary: partial.summary,
    narration,
    entityLabel: partial.entityLabel ?? null,
    entityIcon: partial.entityIcon ?? null,
    occurredAt: partial.occurredAt,
    source: partial.source ?? "test",
    relevanceScore: scoreExecutiveRelevance(partial.severity, partial.category),
    interruptEligible: false,
    isInterruption: false,
    memoryCorrelation: null,
    advisoryOnly: true,
  };
}

void describe("executive ambient signal intelligence", () => {
  it("ranks critical signals above watch", () => {
    const signals = [
      sampleSignal({ id: "a", category: "kpi", severity: "watch", summary: "calm", occurredAt: new Date().toISOString() }),
      sampleSignal({ id: "b", category: "escalation", severity: "critical", summary: "surge", occurredAt: new Date().toISOString() }),
    ];
    const ranked = rankAmbientSignals(signals);
    assert.equal(ranked[0]?.id, "b");
  });

  it("derives crisis presence mode from critical count", () => {
    const mode = deriveOperationalPresenceMode({
      criticalCount: 2,
      highCount: 0,
      escalationDensity: 0,
      workflowPausedCount: 0,
      workflowAtRiskCount: 0,
      pendingApprovals: 0,
      governanceAnomaly: false,
      crisisLevel: "normal",
      kpiDriftScore: 0,
    });
    assert.equal(mode, "crisis");
  });

  it("builds interruption thresholds for high severity", () => {
    const signal = sampleSignal({
      id: "x",
      category: "approval",
      severity: "high",
      summary: "backlog",
      occurredAt: new Date().toISOString(),
    });
    signal.relevanceScore = 0.9;
    signal.interruptEligible = true;
    assert.equal(meetsInterruptionThreshold(signal), true);
    const interruptions = buildAmbientInterruptions([signal]);
    assert.equal(interruptions.length, 1);
  });

  it("builds operational feed with advisory flag", () => {
    const feed = buildExecutiveOperationalFeed([
      sampleSignal({ id: "1", category: "jarva_activity", severity: "low", summary: "jarva", occurredAt: new Date().toISOString() }),
    ]);
    assert.equal(feed.advisoryOnly, true);
    assert.equal(feed.events.length, 1);
  });

  it("derives ambient orb pulse for escalation density", () => {
    const signals = [
      sampleSignal({ id: "e1", category: "escalation", severity: "high", summary: "e1", occurredAt: new Date().toISOString() }),
      sampleSignal({ id: "e2", category: "escalation", severity: "high", summary: "e2", occurredAt: new Date().toISOString() }),
    ];
    const orb = deriveAmbientOrbState({
      presenceOrb: "escalation",
      signals,
      presenceMode: "elevated",
      presenceInput: {
        criticalCount: 0,
        highCount: 2,
        escalationDensity: 0.5,
        workflowPausedCount: 0,
        workflowAtRiskCount: 0,
        pendingApprovals: 1,
        governanceAnomaly: false,
        crisisLevel: "normal",
        kpiDriftScore: 0,
      },
    });
    assert.equal(orb.pulseActive, true);
  });

  it("builds ambient voice briefing for elevated modes", () => {
    const signals = [
      sampleSignal({ id: "c", category: "governance", severity: "high", summary: "anomaly", occurredAt: new Date().toISOString() }),
    ];
    signals[0]!.narration = "Governance anomaly detected.";
    const briefing = buildAmbientVoiceBriefing(signals, "elevated");
    assert.ok(briefing?.includes("Boss"));
  });

  it("enforces signal governance constants", () => {
    assert.equal(EXECUTIVE_SIGNAL_GOVERNANCE.advisoryOnly, true);
    assert.equal(EXECUTIVE_SIGNAL_GOVERNANCE.noAutoLaunchPublishSpend, true);
  });

  it("labels presence modes", () => {
    assert.equal(PRESENCE_MODE_LABEL.calm, "Calm");
    assert.equal(dominantSeverity([]), "watch");
  });
});
