import { describe, it, expect } from "@jest/globals";
import { classifyGovernedPostAnalyticsRefreshFailure } from "@/lib/social/governed-post-analytics-refresh-failure-policy";

describe("classifyGovernedPostAnalyticsRefreshFailure", () => {
  it("classifies provider_unsupported as unsupported without throttle signal", () => {
    const c = classifyGovernedPostAnalyticsRefreshFailure({
      code: "provider_unsupported",
      message: "x has no adapter",
    });
    expect(c.category).toBe("unsupported");
    expect(c.signalsProviderThrottleBackoff).toBe(false);
  });

  it("classifies 429 fetch_error as throttled with backoff signal", () => {
    const c = classifyGovernedPostAnalyticsRefreshFailure({
      code: "fetch_error",
      message: "HTTP 429 Too Many Requests",
    });
    expect(c.category).toBe("throttled");
    expect(c.signalsProviderThrottleBackoff).toBe(true);
  });

  it("classifies rate limit wording as throttled", () => {
    const c = classifyGovernedPostAnalyticsRefreshFailure({
      code: "fetch_error",
      message: "Rate limit exceeded",
    });
    expect(c.category).toBe("throttled");
    expect(c.signalsProviderThrottleBackoff).toBe(true);
  });

  it("classifies timeout fetch_error as transient_network", () => {
    const c = classifyGovernedPostAnalyticsRefreshFailure({
      code: "fetch_error",
      message: "Request timeout",
    });
    expect(c.category).toBe("transient_network");
    expect(c.signalsProviderThrottleBackoff).toBe(false);
  });

  it("classifies no_account as auth_or_token", () => {
    const c = classifyGovernedPostAnalyticsRefreshFailure({
      code: "no_account",
      message: "not connected",
    });
    expect(c.category).toBe("auth_or_token");
    expect(c.signalsProviderThrottleBackoff).toBe(false);
  });

  it("defaults unknown codes conservatively", () => {
    const c = classifyGovernedPostAnalyticsRefreshFailure({
      code: "not_found",
      message: "missing",
    });
    expect(c.category).toBe("unknown");
    expect(c.signalsProviderThrottleBackoff).toBe(false);
  });
});
