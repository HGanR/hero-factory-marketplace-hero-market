/**
 * Classify governed post analytics refresh failures for scheduled-run throttling / ops (Part 47).
 * Grounded in `refreshGovernedPostAnalytics` result codes and adapter error message text.
 */

export type GovernedAnalyticsRefreshFailureCategory =
  | "throttled"
  | "transient_network"
  | "auth_or_token"
  | "unsupported"
  | "unknown";

export type GovernedAnalyticsRefreshFailureClassification = {
  category: GovernedAnalyticsRefreshFailureCategory;
  /** If true, scheduled refresh may count toward provider throttle streak / pause. */
  signalsProviderThrottleBackoff: boolean;
  /** Count as a failed refresh attempt in run metrics. */
  countsAsFailedAttempt: boolean;
};

function classifyFetchErrorMessage(message: string): GovernedAnalyticsRefreshFailureClassification {
  const m = message.toLowerCase();

  if (/\b429\b/.test(m) || m.includes("rate limit") || m.includes("too many requests") || m.includes("throttl")) {
    return {
      category: "throttled",
      signalsProviderThrottleBackoff: true,
      countsAsFailedAttempt: true,
    };
  }

  if (
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("socket hang") ||
    /\b503\b/.test(m) ||
    /\b502\b/.test(m) ||
    /\b504\b/.test(m)
  ) {
    return {
      category: "transient_network",
      signalsProviderThrottleBackoff: false,
      countsAsFailedAttempt: true,
    };
  }

  if (
    /\b401\b/.test(m) ||
    /\b403\b/.test(m) ||
    m.includes("unauthorized") ||
    m.includes("forbidden") ||
    m.includes("invalid token") ||
    m.includes("token expired") ||
    m.includes("oauth")
  ) {
    return {
      category: "auth_or_token",
      signalsProviderThrottleBackoff: false,
      countsAsFailedAttempt: true,
    };
  }

  return {
    category: "unknown",
    signalsProviderThrottleBackoff: false,
    countsAsFailedAttempt: true,
  };
}

/**
 * Map refresh result failure to a coarse category. Conservative on unknowns.
 */
export function classifyGovernedPostAnalyticsRefreshFailure(args: {
  code: string;
  message: string;
}): GovernedAnalyticsRefreshFailureClassification {
  const { code, message } = args;

  if (code === "provider_unsupported") {
    return {
      category: "unsupported",
      signalsProviderThrottleBackoff: false,
      countsAsFailedAttempt: true,
    };
  }

  if (code === "fetch_error") {
    return classifyFetchErrorMessage(message);
  }

  if (code === "no_account" || code === "forbidden") {
    return {
      category: "auth_or_token",
      signalsProviderThrottleBackoff: false,
      countsAsFailedAttempt: true,
    };
  }

  return {
    category: "unknown",
    signalsProviderThrottleBackoff: false,
    countsAsFailedAttempt: true,
  };
}
