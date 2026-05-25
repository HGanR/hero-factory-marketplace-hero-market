import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slimWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow-artifacts-slim";
import type { BentleyWorkflowArtifacts } from "@/lib/revenue-os/bentley-workflow";

const emptyBuckets = (): NonNullable<BentleyWorkflowArtifacts["marketSweep"]> => ({
  trendingTopics: [],
  viralHooks: [],
  painPoints: [],
  buyingSignals: [],
  commentInsights: [],
  competitorAngles: [],
  contentGaps: [],
});

describe("slimWorkflowArtifacts (market sweep slice)", () => {
  it("preserves nextAction.action literal and only slims reason", () => {
    const a: BentleyWorkflowArtifacts = {
      marketSweep: {
        ...emptyBuckets(),
        nextAction: { action: "run_sweep", reason: "x".repeat(2000), priority: 2 },
      },
    };
    const out = slimWorkflowArtifacts(a);
    assert.equal(out.marketSweep?.nextAction?.action, "run_sweep");
    assert.equal(out.marketSweep?.nextAction?.priority, 2);
    assert(out.marketSweep?.nextAction?.reason.length <= 1205);
  });

  it("preserves contentGenerationMode without coercing to string", () => {
    const a: BentleyWorkflowArtifacts = {
      marketSweep: {
        ...emptyBuckets(),
        contentGenerationMode: "research_first",
      },
    };
    assert.equal(slimWorkflowArtifacts(a).marketSweep?.contentGenerationMode, "research_first");
  });

  it("preserves growthGuidance operational overlays and caps long summaries", () => {
    const a: BentleyWorkflowArtifacts = {
      marketSweep: {
        ...emptyBuckets(),
        growthGuidance: {
          recommendedNextMove: "m",
          why: "w",
          risingTopics: [],
          weakAngles: [],
          bestHookDirection: "h",
          systemHealthScore: 87,
          topUrgentWorkspace: "Acme",
          publishFailureSummary: "F".repeat(800),
        },
      },
    };
    const g = slimWorkflowArtifacts(a).marketSweep?.growthGuidance;
    assert.equal(g?.systemHealthScore, 87);
    assert.equal(g?.topUrgentWorkspace, "Acme");
    assert(g?.publishFailureSummary != null && g.publishFailureSummary.length <= 605);
  });
});
