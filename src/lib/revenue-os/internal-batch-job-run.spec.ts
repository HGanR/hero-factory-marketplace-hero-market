/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  INTERNAL_JOB_MAX_BOUNDED_ERRORS,
  INTERNAL_JOB_MAX_MESSAGE_LEN,
  buildNormalizedInternalJobResult,
  deriveInternalJobRunStatus,
  pushBoundedInternalJobError,
  truncateInternalJobMessage,
} from "@/lib/revenue-os/internal-batch-job-run";

describe("internal-batch-job-run", () => {
  it("builds normalized payload with nested summary and optional errors", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const finishedAt = new Date("2026-01-01T00:00:01.500Z");
    const n = buildNormalizedInternalJobResult({
      jobType: "test_job",
      startedAt,
      finishedAt,
      summary: { campaignsScanned: 2, errors: 0 },
      boundedErrors: [],
    });
    expect(n.ok).toBe(true);
    expect(n.jobType).toBe("test_job");
    expect(n.durationMs).toBe(1500);
    expect(n.summary).toEqual({ campaignsScanned: 2, errors: 0 });
    expect(n.errors).toBeUndefined();
    expect(n.partialFailure).toBeUndefined();
  });

  it("sets partialFailure when bounded errors present", () => {
    const startedAt = new Date();
    const finishedAt = new Date(startedAt.getTime() + 100);
    const n = buildNormalizedInternalJobResult({
      jobType: "j",
      startedAt,
      finishedAt,
      summary: { errors: 1, x: 1 },
      boundedErrors: [{ campaignId: "c1", message: "oops" }],
    });
    expect(n.partialFailure).toBe(true);
    expect(n.errors).toHaveLength(1);
    expect(n.errors?.[0].campaignId).toBe("c1");
  });

  it("derives partial status from summary error count alone", () => {
    expect(
      deriveInternalJobRunStatus({
        boundedErrors: [],
        summary: { errors: 2 },
      })
    ).toBe("partial");
  });

  it("bounds error list length", () => {
    const list: { campaignId?: string; message: string }[] = [];
    for (let i = 0; i < INTERNAL_JOB_MAX_BOUNDED_ERRORS + 10; i += 1) {
      pushBoundedInternalJobError(list, { message: `e${i}` });
    }
    expect(list.length).toBe(INTERNAL_JOB_MAX_BOUNDED_ERRORS);
  });

  it("truncates long messages", () => {
    const long = "x".repeat(INTERNAL_JOB_MAX_MESSAGE_LEN + 40);
    expect(truncateInternalJobMessage(long).length).toBeLessThanOrEqual(INTERNAL_JOB_MAX_MESSAGE_LEN + 2);
  });
});
