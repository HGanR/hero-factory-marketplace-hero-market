/**
 * Classifies Meta paid sync failures for operator UX + backoff (Part 52).
 */

import { MetaMarketingApiError } from "@/lib/social/paid-social-meta-marketing-api";

export type PaidMetaSyncFailureCategory =
  | "throttled"
  | "auth_or_token"
  | "transient_network"
  | "partial_data"
  | "network"
  | "not_found"
  | "unknown";

export type PaidMetaSyncPhaseErrorKind =
  | "throttled"
  | "auth"
  | "network"
  | "partial_data"
  | "not_found"
  | "unknown";

export type ClassifiedPaidMetaSyncApiError = {
  category: PaidMetaSyncFailureCategory;
  signalsProviderThrottleBackoff: boolean;
};

export function classifyPaidMetaSyncApiError(err: unknown): ClassifiedPaidMetaSyncApiError {
  if (err instanceof MetaMarketingApiError) {
    const code = err.metaCode;
    if (code === 4 || code === 17) {
      return { category: "throttled", signalsProviderThrottleBackoff: true };
    }
    if (code === 190 || code === 102) {
      return { category: "auth_or_token", signalsProviderThrottleBackoff: false };
    }
    const msg = err.message.toLowerCase();
    if (msg.includes("oauth") || msg.includes("token")) {
      return { category: "auth_or_token", signalsProviderThrottleBackoff: false };
    }
  }
  const m = err instanceof Error ? err.message.toLowerCase() : "";
  if (m.includes("socket") || m.includes("network") || m.includes("econnreset") || m.includes("timeout")) {
    return { category: "transient_network", signalsProviderThrottleBackoff: false };
  }
  return { category: "unknown", signalsProviderThrottleBackoff: false };
}

export function classifyMetaSyncPhaseKind(kind: string): { signalsProviderThrottleBackoff: boolean } {
  return { signalsProviderThrottleBackoff: kind === "throttled" };
}

export function partialDataSparseInsightsClassification(): {
  category: PaidMetaSyncFailureCategory;
  countsAsHardFailure: boolean;
  isSoftPartial: boolean;
} {
  return { category: "partial_data", countsAsHardFailure: false, isSoftPartial: true };
}

export function summarizePaidMetaSyncBundle(input: {
  phaseErrors: Array<{ kind?: string }>;
  hasAnyNode: boolean;
}): {
  isTotalFailure: boolean;
  hadThrottle: boolean;
  hadAuth: boolean;
  worstHardCategory: PaidMetaSyncFailureCategory | null;
} {
  const kinds = input.phaseErrors.map((e) => String(e.kind ?? ""));
  const hadThrottle = kinds.includes("throttled");
  const hadAuth = kinds.includes("auth");
  const isTotalFailure = !input.hasAnyNode && input.phaseErrors.length > 0;

  let worstHardCategory: PaidMetaSyncFailureCategory | null = null;
  if (hadAuth) worstHardCategory = "auth_or_token";
  else if (hadThrottle) worstHardCategory = "throttled";
  else if (kinds.includes("network")) worstHardCategory = "transient_network";
  else if (input.phaseErrors.length > 0) worstHardCategory = "unknown";

  return { isTotalFailure, hadThrottle, hadAuth, worstHardCategory };
}
