/**
 * @jest-environment node
 */

import {
  buildDefaultMetricSyncContext,
  evidenceVolumeDampening,
  getPlatformEvidenceQuality,
  getPlatformEvidenceWeight,
  hasMeasuredSignalsInEvidence,
  inferMemoryEntryEvidenceInference,
  summarizePlatformEvidenceWeighting,
} from "@/lib/revenue-os/platform-evidence-weighting";

describe("platform-evidence-weighting", () => {
  const ctx = {
    liveMetricPlatforms: ["instagram"] as const,
    stubPublishPlatforms: ["linkedin"] as const,
  };

  it("classifies Instagram as live_metrics and LinkedIn as publish_only", () => {
    expect(getPlatformEvidenceQuality("instagram", ctx)).toBe("live_metrics");
    expect(getPlatformEvidenceQuality("linkedin", ctx)).toBe("publish_only");
    expect(getPlatformEvidenceWeight("instagram", ctx)).toBeGreaterThan(getPlatformEvidenceWeight("linkedin", ctx));
  });

  it("dampens sparse publish volume deterministically", () => {
    expect(evidenceVolumeDampening({ publishCount: 1 })).toBeLessThan(evidenceVolumeDampening({ publishCount: 9 }));
    expect(evidenceVolumeDampening({ publishCount: 1 })).toBe(evidenceVolumeDampening({ publishCount: 1 }));
  });

  it("detects measured signals in evidence with conservative thresholds", () => {
    expect(hasMeasuredSignalsInEvidence({ impressions: 10 })).toBe(false);
    expect(hasMeasuredSignalsInEvidence({ impressions: 250 })).toBe(true);
    expect(hasMeasuredSignalsInEvidence({ clicks: 1 })).toBe(true);
  });

  it("infers entry-level live_metrics only when platform is live and evidence has metrics", () => {
    const live = inferMemoryEntryEvidenceInference(
      "instagram",
      { publishCount: 3, impressions: 500 },
      ctx
    );
    expect(live.evidenceQuality).toBe("live_metrics");

    const liveNoMetrics = inferMemoryEntryEvidenceInference(
      "instagram",
      { publishCount: 4, impressions: 0 },
      ctx
    );
    expect(liveNoMetrics.evidenceQuality).toBe("publish_only");

    const li = inferMemoryEntryEvidenceInference("linkedin", { publishCount: 6, impressions: 900 }, ctx);
    expect(li.evidenceQuality).toBe("publish_only");
  });

  it("summarizePlatformEvidenceWeighting returns stable maps", () => {
    const a = summarizePlatformEvidenceWeighting(ctx);
    const b = summarizePlatformEvidenceWeighting(ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.weights["instagram"]).toBe(getPlatformEvidenceWeight("instagram", ctx));
  });

  it("buildDefaultMetricSyncContext is deterministic", () => {
    expect(JSON.stringify(buildDefaultMetricSyncContext())).toBe(JSON.stringify(buildDefaultMetricSyncContext()));
  });
});
