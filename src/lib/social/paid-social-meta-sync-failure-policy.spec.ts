/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { MetaMarketingApiError } from "@/lib/social/paid-social-meta-marketing-api";
import {
  classifyMetaSyncPhaseKind,
  classifyPaidMetaSyncApiError,
  partialDataSparseInsightsClassification,
  summarizePaidMetaSyncBundle,
} from "@/lib/social/paid-social-meta-sync-failure-policy";

describe("classifyPaidMetaSyncApiError", () => {
  it("detects throttle via Meta code", () => {
    const c = classifyPaidMetaSyncApiError(new MetaMarketingApiError("x", { metaCode: 4 }));
    expect(c.category).toBe("throttled");
    expect(c.signalsProviderThrottleBackoff).toBe(true);
  });

  it("detects auth via code 190", () => {
    const c = classifyPaidMetaSyncApiError(new MetaMarketingApiError("OAuth", { metaCode: 190 }));
    expect(c.category).toBe("auth_or_token");
  });

  it("detects transient network", () => {
    const c = classifyPaidMetaSyncApiError(new Error("socket hang up"));
    expect(c.category).toBe("transient_network");
  });
});

describe("classifyMetaSyncPhaseKind", () => {
  it("maps throttled phase kind", () => {
    expect(classifyMetaSyncPhaseKind("throttled").signalsProviderThrottleBackoff).toBe(true);
  });
});

describe("partialDataSparseInsightsClassification", () => {
  it("is soft partial, not hard failure", () => {
    const c = partialDataSparseInsightsClassification();
    expect(c.category).toBe("partial_data");
    expect(c.countsAsHardFailure).toBe(false);
    expect(c.isSoftPartial).toBe(true);
  });
});

describe("summarizePaidMetaSyncBundle", () => {
  it("treats total failure when no nodes and errors present", () => {
    const s = summarizePaidMetaSyncBundle({
      phaseErrors: [{ kind: "network" }],
      hasAnyNode: false,
    });
    expect(s.isTotalFailure).toBe(true);
    expect(s.hadThrottle).toBe(false);
  });

  it("flags throttle streak input from phase errors", () => {
    const s = summarizePaidMetaSyncBundle({
      phaseErrors: [{ kind: "throttled" }],
      hasAnyNode: true,
    });
    expect(s.hadThrottle).toBe(true);
    expect(s.isTotalFailure).toBe(false);
  });
});
