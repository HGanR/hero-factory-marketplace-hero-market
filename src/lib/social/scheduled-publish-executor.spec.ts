import {
  isScheduledPostDue,
  computeScheduledPublishRetryDelay,
  isRetryableScheduledPublishError,
  normalizeScheduledPublishFailure,
  buildRetryMetaAfterFailure,
} from "@/lib/social/scheduled-publish-executor";

describe("scheduled-publish-executor", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("isScheduledPostDue for SCHEDULED when scheduledAt passed", () => {
    expect(
      isScheduledPostDue(
        {
          id: "1",
          status: "SCHEDULED",
          scheduledAt: new Date("2026-01-15T11:00:00.000Z"),
        },
        now
      )
    ).toBe(true);
    expect(
      isScheduledPostDue(
        {
          id: "1",
          status: "SCHEDULED",
          scheduledAt: new Date("2026-01-15T13:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("isScheduledPostDue for RETRY_SCHEDULED uses nextPublishAttemptAt", () => {
    expect(
      isScheduledPostDue(
        {
          id: "1",
          status: "RETRY_SCHEDULED",
          scheduledAt: null,
          scheduledPublishMeta: { nextPublishAttemptAt: "2026-01-15T11:30:00.000Z" },
        },
        now
      )
    ).toBe(true);
  });

  it("computeScheduledPublishRetryDelay follows 5m / 15m / 60m / stop", () => {
    expect(computeScheduledPublishRetryDelay(1)).toBe(5 * 60 * 1000);
    expect(computeScheduledPublishRetryDelay(2)).toBe(15 * 60 * 1000);
    expect(computeScheduledPublishRetryDelay(3)).toBe(60 * 60 * 1000);
    expect(computeScheduledPublishRetryDelay(4)).toBeNull();
  });

  it("isRetryableScheduledPublishError classifies transient vs permanent", () => {
    expect(isRetryableScheduledPublishError("HTTP 429 rate limit")).toBe(true);
    expect(isRetryableScheduledPublishError("fetch failed")).toBe(true);
    expect(isRetryableScheduledPublishError("ACCOUNT_NOT_CONNECTED")).toBe(false);
    expect(isRetryableScheduledPublishError("validation error")).toBe(false);
  });

  it("buildRetryMetaAfterFailure schedules retry for transient errors", () => {
    const r = buildRetryMetaAfterFailure({
      now,
      prevMeta: {},
      failure: { code: "E", message: "timeout", retryable: true },
    });
    expect(r.status).toBe("RETRY_SCHEDULED");
    expect(r.meta.publishAttemptCount).toBe(1);
    expect(r.meta.nextPublishAttemptAt).toBeDefined();
  });

  it("buildRetryMetaAfterFailure fails hard for non-retryable", () => {
    const r = buildRetryMetaAfterFailure({
      now,
      prevMeta: {},
      failure: { code: "ACCOUNT_NOT_CONNECTED", message: "no account", retryable: false },
    });
    expect(r.status).toBe("FAILED");
    expect(r.meta.nextPublishAttemptAt).toBeUndefined();
  });

  it("buildRetryMetaAfterFailure caps after max attempts", () => {
    const r = buildRetryMetaAfterFailure({
      now,
      prevMeta: { publishAttemptCount: 3 },
      failure: { code: "E", message: "timeout", retryable: true },
    });
    expect(r.status).toBe("FAILED");
  });

  it("normalizeScheduledPublishFailure preserves codes", () => {
    const e = new Error("x") as Error & { code?: string };
    e.code = "ETIMEDOUT";
    const n = normalizeScheduledPublishFailure(e, "FALLBACK");
    expect(n.code).toBe("ETIMEDOUT");
  });
});
