/**
 * @jest-environment node
 */

import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import { normalizePerformanceSnapshotToFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import {
  buildOptimizationMemoryFromFeedback,
  classifyOptimizationOutcome,
  computeOptimizationPatternKey,
  enrichOptimizationMemoryEntries,
  summarizeOptimizationMemory,
} from "@/lib/revenue-os/build-post-optimization-memory";
import { buildOptimizationMemoryPromptBlock } from "@/lib/revenue-os/resolve-optimization-memory-for-generation";

function publishRow(
  campaignPostId: string,
  campaignId: string,
  platform: string,
  status: "published" | "failed",
  source: NormalizedDeploymentFeedback["source"] = "manual_publish"
): NormalizedDeploymentFeedback {
  return {
    campaignPostId,
    campaignId,
    platform,
    publishStatus: status,
    source,
    recordedAt: "2026-01-01T12:00:00.000Z",
    feedbackRowKind: "publish_outcome",
    publishedAt: status === "published" ? "2026-01-01T12:00:00.000Z" : null,
  };
}

describe("classifyOptimizationOutcome", () => {
  it("returns insufficient_data when publish history is sparse", () => {
    expect(classifyOptimizationOutcome({ publishCount: 1, failures: 0 })).toBe("insufficient_data");
    expect(classifyOptimizationOutcome({ publishCount: 2, failures: 0 })).toBe("insufficient_data");
  });

  it("returns negative when failures dominate", () => {
    expect(classifyOptimizationOutcome({ publishCount: 1, failures: 2 })).toBe("negative");
  });

  it("returns positive when metrics are strong and failure rate is low", () => {
    expect(
      classifyOptimizationOutcome({
        publishCount: 3,
        failures: 0,
        impressions: 3000,
      })
    ).toBe("positive");
  });

  it("returns mixed for moderate metrics with enough publishes", () => {
    expect(
      classifyOptimizationOutcome({
        publishCount: 4,
        failures: 0,
        impressions: 500,
      })
    ).toBe("mixed");
  });
});

describe("buildOptimizationMemoryFromFeedback", () => {
  it("yields insufficient_data for publish-only sparse feedback", () => {
    const rows: NormalizedDeploymentFeedback[] = [publishRow("p1", "c1", "tiktok", "published")];
    const entries = buildOptimizationMemoryFromFeedback({
      userId: "9",
      feedbackRows: rows,
      postsById: {
        p1: {
          id: "p1",
          campaignId: "c1",
          platform: "tiktok",
          caption: "Hello world hook",
          linkUrl: null,
          utmParams: null,
        },
      },
    });
    expect(entries.length).toBe(1);
    expect(entries[0].outcomeKind).toBe("insufficient_data");
  });

  it("merges repeated publishes on one platform/hook toward stronger outcomes when metrics exist", () => {
    const rows: NormalizedDeploymentFeedback[] = [
      publishRow("p1", "c1", "tiktok", "published"),
      publishRow("p2", "c1", "tiktok", "published"),
      publishRow("p3", "c1", "tiktok", "published"),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "p1",
        campaignId: "c1",
        platform: "tiktok",
        source: "platform_sync",
        impressions: 900,
        recordedAt: new Date("2026-01-02T12:00:00.000Z"),
      }),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "p2",
        campaignId: "c1",
        platform: "tiktok",
        source: "platform_sync",
        impressions: 900,
        recordedAt: new Date("2026-01-02T12:00:00.000Z"),
      }),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "p3",
        campaignId: "c1",
        platform: "tiktok",
        source: "platform_sync",
        impressions: 900,
        recordedAt: new Date("2026-01-02T12:00:00.000Z"),
      }),
    ];
    const post = {
      id: "p1",
      campaignId: "c1",
      platform: "tiktok",
      caption: "Same hook line\nbody",
      linkUrl: null,
      utmParams: null,
    };
    const entries = buildOptimizationMemoryFromFeedback({
      userId: "9",
      feedbackRows: rows,
      postsById: {
        p1: post,
        p2: { ...post, id: "p2" },
        p3: { ...post, id: "p3" },
      },
    });
    expect(entries.length).toBe(1);
    expect(entries[0].outcomeKind).toBe("positive");
    expect(entries[0].evidence.publishCount).toBe(3);
    expect(entries[0].evidence.impressions).toBe(2700);
  });
});

describe("summarizeOptimizationMemory", () => {
  it("surfaces strongest/weakest and platform preferences deterministically", () => {
    const entries = buildOptimizationMemoryFromFeedback({
      userId: "1",
      feedbackRows: [
        publishRow("a", "c", "linkedin", "published"),
        publishRow("b", "c", "linkedin", "published"),
        publishRow("d", "c", "linkedin", "published"),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "a",
          campaignId: "c",
          platform: "linkedin",
          source: "platform_sync",
          impressions: 900,
          recordedAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "b",
          campaignId: "c",
          platform: "linkedin",
          source: "platform_sync",
          impressions: 900,
          recordedAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "d",
          campaignId: "c",
          platform: "linkedin",
          source: "platform_sync",
          impressions: 900,
          recordedAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
      ],
      postsById: {
        a: {
          id: "a",
          campaignId: "c",
          platform: "linkedin",
          caption: "Win on LinkedIn today",
          linkUrl: null,
          utmParams: null,
        },
        b: {
          id: "b",
          campaignId: "c",
          platform: "linkedin",
          caption: "Win on LinkedIn today",
          linkUrl: null,
          utmParams: null,
        },
        d: {
          id: "d",
          campaignId: "c",
          platform: "linkedin",
          caption: "Win on LinkedIn today",
          linkUrl: null,
          utmParams: null,
        },
      },
    });
    const sum = summarizeOptimizationMemory(entries);
    expect(sum.strongestPatterns.length).toBeGreaterThan(0);
    expect(sum.platformPreferences.linkedin?.length).toBeGreaterThan(0);
    const sum2 = summarizeOptimizationMemory(entries);
    expect(JSON.stringify(sum)).toBe(JSON.stringify(sum2));
  });
});

describe("buildOptimizationMemoryPromptBlock", () => {
  it("returns null block when only insufficient_data rows and small set", () => {
    const { block } = buildOptimizationMemoryPromptBlock([
      {
        id: "x",
        source: "manual",
        outcomeKind: "insufficient_data",
        evidence: { publishCount: 1 },
        summary: "n/a",
        platform: "x",
      },
    ]);
    expect(block).toBeNull();
  });

  it("returns stable JSON shape for informative memory", () => {
    const entries = buildOptimizationMemoryFromFeedback({
      userId: "1",
      feedbackRows: [
        publishRow("a", "c", "tiktok", "published"),
        publishRow("b", "c", "tiktok", "published"),
        publishRow("d", "c", "tiktok", "published"),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "a",
          campaignId: "c",
          platform: "tiktok",
          source: "platform_sync",
          impressions: 900,
          recordedAt: new Date("2026-01-04T00:00:00.000Z"),
        }),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "b",
          campaignId: "c",
          platform: "tiktok",
          source: "platform_sync",
          impressions: 900,
          recordedAt: new Date("2026-01-04T00:00:00.000Z"),
        }),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "d",
          campaignId: "c",
          platform: "tiktok",
          source: "platform_sync",
          impressions: 900,
          recordedAt: new Date("2026-01-04T00:00:00.000Z"),
        }),
      ],
      postsById: {
        a: {
          id: "a",
          campaignId: "c",
          platform: "tiktok",
          caption: "Hook A",
          linkUrl: null,
          utmParams: null,
        },
        b: {
          id: "b",
          campaignId: "c",
          platform: "tiktok",
          caption: "Hook A",
          linkUrl: null,
          utmParams: null,
        },
        d: {
          id: "d",
          campaignId: "c",
          platform: "tiktok",
          caption: "Hook A",
          linkUrl: null,
          utmParams: null,
        },
      },
    }).map((e, i) => ({ ...e, id: `id-${i}` }));
    const { block, injectedEntryIds } = buildOptimizationMemoryPromptBlock(entries);
    expect(block).toContain("=== OPTIMIZATION MEMORY ===");
    expect(injectedEntryIds.length).toBeGreaterThan(0);
    const { block: block2 } = buildOptimizationMemoryPromptBlock(entries);
    expect(block).toBe(block2);
  });

  it("keeps prompt block compact when measuredPlatformPreferenceHint is present", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const feedbackRows = [
      publishRow("i1", "c", "instagram", "published"),
      publishRow("i2", "c", "instagram", "published"),
      publishRow("i3", "c", "instagram", "published"),
      publishRow("i4", "c", "instagram", "published"),
      ...[1, 2, 3, 4].map((n) =>
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: `i${n}`,
          campaignId: "c",
          platform: "instagram",
          source: "platform_sync",
          impressions: 500,
          recordedAt: new Date("2026-01-09T12:00:00.000Z"),
        })
      ),
      publishRow("l1", "c", "linkedin", "published"),
      publishRow("l2", "c", "linkedin", "published"),
      publishRow("l3", "c", "linkedin", "published"),
      publishRow("l4", "c", "linkedin", "published"),
    ];
    const postsById = {
      i1: { id: "i1", campaignId: "c", platform: "instagram", caption: "H", linkUrl: null, utmParams: null },
      i2: { id: "i2", campaignId: "c", platform: "instagram", caption: "H", linkUrl: null, utmParams: null },
      i3: { id: "i3", campaignId: "c", platform: "instagram", caption: "H", linkUrl: null, utmParams: null },
      i4: { id: "i4", campaignId: "c", platform: "instagram", caption: "H", linkUrl: null, utmParams: null },
      l1: { id: "l1", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
      l2: { id: "l2", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
      l3: { id: "l3", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
      l4: { id: "l4", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
    };
    const entries = buildOptimizationMemoryFromFeedback({ userId: "1", feedbackRows, postsById }).map((e, i) => ({
      ...e,
      id: `p-${i}`,
    }));
    const enriched = enrichOptimizationMemoryEntries(entries, ctx);
    const { block, instagramPreferenceHint } = buildOptimizationMemoryPromptBlock(enriched, { metricSyncContext: ctx });
    expect(block).toBeTruthy();
    expect(block!).toContain("measuredPlatformPreferenceHint");
    expect(instagramPreferenceHint).toBeTruthy();
    expect(block!.length).toBeLessThan(9000);
    expect((block!.match(/measuredPlatformPreferenceHint/g) ?? []).length).toBe(1);
  });
});

describe("weighted summarizeOptimizationMemory", () => {
  const mixedCtx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };

  it("prefers Instagram measured patterns over LinkedIn publish-only when scores compete", () => {
    const ig = buildOptimizationMemoryFromFeedback({
      userId: "1",
      feedbackRows: [
        publishRow("i1", "c", "instagram", "published"),
        publishRow("i2", "c", "instagram", "published"),
        publishRow("i3", "c", "instagram", "published"),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "i1",
          campaignId: "c",
          platform: "instagram",
          source: "platform_sync",
          impressions: 400,
          recordedAt: new Date("2026-01-05T00:00:00.000Z"),
        }),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "i2",
          campaignId: "c",
          platform: "instagram",
          source: "platform_sync",
          impressions: 400,
          recordedAt: new Date("2026-01-05T00:00:00.000Z"),
        }),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "i3",
          campaignId: "c",
          platform: "instagram",
          source: "platform_sync",
          impressions: 400,
          recordedAt: new Date("2026-01-05T00:00:00.000Z"),
        }),
      ],
      postsById: {
        i1: { id: "i1", campaignId: "c", platform: "instagram", caption: "Ig hook", linkUrl: null, utmParams: null },
        i2: { id: "i2", campaignId: "c", platform: "instagram", caption: "Ig hook", linkUrl: null, utmParams: null },
        i3: { id: "i3", campaignId: "c", platform: "instagram", caption: "Ig hook", linkUrl: null, utmParams: null },
      },
    });
    const li = buildOptimizationMemoryFromFeedback({
      userId: "1",
      feedbackRows: [
        publishRow("l1", "c", "linkedin", "published"),
        publishRow("l2", "c", "linkedin", "published"),
        publishRow("l3", "c", "linkedin", "published"),
        publishRow("l4", "c", "linkedin", "published"),
        publishRow("l5", "c", "linkedin", "published"),
        publishRow("l6", "c", "linkedin", "published"),
      ],
      postsById: {
        l1: { id: "l1", campaignId: "c", platform: "linkedin", caption: "Li hook", linkUrl: null, utmParams: null },
        l2: { id: "l2", campaignId: "c", platform: "linkedin", caption: "Li hook", linkUrl: null, utmParams: null },
        l3: { id: "l3", campaignId: "c", platform: "linkedin", caption: "Li hook", linkUrl: null, utmParams: null },
        l4: { id: "l4", campaignId: "c", platform: "linkedin", caption: "Li hook", linkUrl: null, utmParams: null },
        l5: { id: "l5", campaignId: "c", platform: "linkedin", caption: "Li hook", linkUrl: null, utmParams: null },
        l6: { id: "l6", campaignId: "c", platform: "linkedin", caption: "Li hook", linkUrl: null, utmParams: null },
      },
    });
    const merged = [...ig, ...li].map((e, i) => ({ ...e, id: `m-${i}` }));
    const enriched = enrichOptimizationMemoryEntries(merged, mixedCtx);
    const sum = summarizeOptimizationMemory(enriched, { metricSyncContext: mixedCtx });
    expect(sum.strongestPatterns[0]?.platform).toBe("instagram");
    expect(sum.measuredStrongestPlatform).toBe("instagram");
    expect(sum.operationalStrongestPlatform).toBe("linkedin");
  });

  it("sets instagramMeasuredPreference when Instagram measured gates pass", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const feedbackRows = [
      publishRow("i1", "c", "instagram", "published"),
      publishRow("i2", "c", "instagram", "published"),
      publishRow("i3", "c", "instagram", "published"),
      publishRow("i4", "c", "instagram", "published"),
      ...[1, 2, 3, 4].map((n) =>
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: `i${n}`,
          campaignId: "c",
          platform: "instagram",
          source: "platform_sync",
          impressions: 600,
          recordedAt: new Date("2026-01-07T12:00:00.000Z"),
        })
      ),
      publishRow("l1", "c", "linkedin", "published"),
      publishRow("l2", "c", "linkedin", "published"),
      publishRow("l3", "c", "linkedin", "published"),
      publishRow("l4", "c", "linkedin", "published"),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "l1",
        campaignId: "c",
        platform: "linkedin",
        source: "platform_sync",
        impressions: 50,
        recordedAt: new Date("2026-01-07T12:00:00.000Z"),
      }),
    ];
    const postsById = {
      i1: { id: "i1", campaignId: "c", platform: "instagram", caption: "IG A", linkUrl: null, utmParams: null },
      i2: { id: "i2", campaignId: "c", platform: "instagram", caption: "IG A", linkUrl: null, utmParams: null },
      i3: { id: "i3", campaignId: "c", platform: "instagram", caption: "IG A", linkUrl: null, utmParams: null },
      i4: { id: "i4", campaignId: "c", platform: "instagram", caption: "IG A", linkUrl: null, utmParams: null },
      l1: { id: "l1", campaignId: "c", platform: "linkedin", caption: "LI", linkUrl: null, utmParams: null },
      l2: { id: "l2", campaignId: "c", platform: "linkedin", caption: "LI", linkUrl: null, utmParams: null },
      l3: { id: "l3", campaignId: "c", platform: "linkedin", caption: "LI", linkUrl: null, utmParams: null },
      l4: { id: "l4", campaignId: "c", platform: "linkedin", caption: "LI", linkUrl: null, utmParams: null },
    };
    const entries = buildOptimizationMemoryFromFeedback({ userId: "1", feedbackRows, postsById }).map((e, i) => ({
      ...e,
      id: `ig-${i}`,
    }));
    const enriched = enrichOptimizationMemoryEntries(entries, ctx);
    const sum = summarizeOptimizationMemory(enriched, { metricSyncContext: ctx });
    expect(sum.measuredStrongestPlatform).toBe("instagram");
    expect(sum.instagramMeasuredPreference?.active).toBe(true);
    expect(sum.nextGenerationRecommendation).toMatch(/Instagram is showing the strongest measured \*\*attention\*\* signal/);
  });

  it("does not set instagramMeasuredPreference when Instagram sample is tiny", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const feedbackRows = [
      publishRow("i1", "c", "instagram", "published"),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "i1",
        campaignId: "c",
        platform: "instagram",
        source: "platform_sync",
        impressions: 800,
        recordedAt: new Date("2026-01-08T12:00:00.000Z"),
      }),
      publishRow("l1", "c", "linkedin", "published"),
      publishRow("l2", "c", "linkedin", "published"),
      publishRow("l3", "c", "linkedin", "published"),
      publishRow("l4", "c", "linkedin", "published"),
    ];
    const postsById = {
      i1: { id: "i1", campaignId: "c", platform: "instagram", caption: "Solo", linkUrl: null, utmParams: null },
      l1: { id: "l1", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
      l2: { id: "l2", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
      l3: { id: "l3", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
      l4: { id: "l4", campaignId: "c", platform: "linkedin", caption: "L", linkUrl: null, utmParams: null },
    };
    const entries = buildOptimizationMemoryFromFeedback({ userId: "1", feedbackRows, postsById }).map((e, i) => ({
      ...e,
      id: `t-${i}`,
    }));
    const enriched = enrichOptimizationMemoryEntries(entries, ctx);
    const sum = summarizeOptimizationMemory(enriched, { metricSyncContext: ctx });
    expect(sum.instagramMeasuredPreference).toBeUndefined();
  });

  it("sparse live_metrics sample does not outrank heavy publish_only on raw volume alone", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const ig = buildOptimizationMemoryFromFeedback({
      userId: "1",
      feedbackRows: [
        publishRow("i1", "c", "instagram", "published"),
        normalizePerformanceSnapshotToFeedback({
          campaignPostId: "i1",
          campaignId: "c",
          platform: "instagram",
          source: "platform_sync",
          impressions: 250,
          recordedAt: new Date("2026-01-06T00:00:00.000Z"),
        }),
      ],
      postsById: {
        i1: { id: "i1", campaignId: "c", platform: "instagram", caption: "Solo ig", linkUrl: null, utmParams: null },
      },
    });
    const li = buildOptimizationMemoryFromFeedback({
      userId: "1",
      feedbackRows: Array.from({ length: 12 }, (_, i) =>
        publishRow(`l${i}`, "c", "linkedin", "published")
      ),
      postsById: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [
          `l${i}`,
          { id: `l${i}`, campaignId: "c", platform: "linkedin", caption: "Heavy li", linkUrl: null, utmParams: null },
        ])
      ),
    });
    const merged = [...ig, ...li].map((e, i) => ({ ...e, id: `s-${i}` }));
    const enriched = enrichOptimizationMemoryEntries(merged, ctx);
    const sum = summarizeOptimizationMemory(enriched, { metricSyncContext: ctx });
    expect(sum.strongestPatterns[0]?.platform).toBe("linkedin");
  });
});

describe("computeOptimizationPatternKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeOptimizationPatternKey({
      platform: "tiktok",
      hookNorm: "x",
      angleNorm: "",
      ctaNorm: "",
    });
    const b = computeOptimizationPatternKey({
      platform: "tiktok",
      hookNorm: "x",
      angleNorm: "",
      ctaNorm: "",
    });
    expect(a).toBe(b);
    expect(a.length).toBe(32);
  });
});
