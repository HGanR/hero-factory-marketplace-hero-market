/**
 * @jest-environment node
 */

import {
  buildMetricSyncCapabilitySummary,
  getMetricSyncAdapterDebugLabel,
  getPlatformPerformanceCapability,
  RECOMMENDED_METRIC_SYNC_IMPLEMENTATION_ORDER,
} from "@/lib/social/platform-performance-adapter-capabilities";

describe("platform-performance-adapter-capabilities", () => {
  it("marks Instagram and LinkedIn as live metric sync when publish adapters exist", () => {
    const ig = getPlatformPerformanceCapability("instagram");
    const li = getPlatformPerformanceCapability("linkedin");
    expect(ig.metricSyncImplementation).toBe("live");
    expect(ig.supportsPublish).toBe(true);
    expect(li.metricSyncImplementation).toBe("live");
    expect(li.supportsPublish).toBe(true);
    expect(li.supportsMetricSync).toBe(true);
  });

  it("exposes debug labels for adapter rollout", () => {
    expect(getMetricSyncAdapterDebugLabel("instagram")).toBe("real");
    expect(getMetricSyncAdapterDebugLabel("linkedin")).toBe("real");
    expect(getMetricSyncAdapterDebugLabel("facebook")).toBe("none");
  });

  it("recommends Instagram first in implementation order", () => {
    expect(RECOMMENDED_METRIC_SYNC_IMPLEMENTATION_ORDER[0]).toBe("instagram");
  });

  it("buildMetricSyncCapabilitySummary includes narrative lines", () => {
    const s = buildMetricSyncCapabilitySummary();
    expect(s.firstImplementationTarget).toBe("instagram");
    expect(s.narrativeLines.some((l) => /instagram/i.test(l) && /linkedin/i.test(l))).toBe(true);
  });
});
