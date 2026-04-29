/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { computeBentleyOptimizationKey } from "@/lib/revenue-os/bentley-optimization-persist";

describe("computeBentleyOptimizationKey", () => {
  it("is deterministic for same inputs", () => {
    const a = computeBentleyOptimizationKey({
      mode: "recommend_only",
      bentleyRunId: "b1",
      metricsFingerprint: "fp1",
    });
    const b = computeBentleyOptimizationKey({
      mode: "recommend_only",
      bentleyRunId: "b1",
      metricsFingerprint: "fp1",
    });
    expect(a).toBe(b);
    expect(a.length).toBe(48);
  });

  it("changes when fingerprint changes", () => {
    const a = computeBentleyOptimizationKey({
      mode: "recommend_only",
      bentleyRunId: null,
      metricsFingerprint: "a",
    });
    const b = computeBentleyOptimizationKey({
      mode: "recommend_only",
      bentleyRunId: null,
      metricsFingerprint: "b",
    });
    expect(a).not.toBe(b);
  });
});
