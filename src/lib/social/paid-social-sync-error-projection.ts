/**
 * Structured operator-facing sync error states (Part 52). Separate from launch lifecycle and Meta runtime.
 */

import type { PaidMetaSyncFailureCategory } from "@/lib/social/paid-social-meta-sync-failure-policy";

export type PaidStructuredSyncOperatorState =
  | "auth_blocked"
  | "throttled"
  | "partial_data"
  | "transient_failure"
  | "not_found"
  | "unknown";

export type PaidStructuredSyncRetryHint = "now" | "later" | "unlikely";

export type PaidStructuredSyncErrorProjection = {
  state: PaidStructuredSyncOperatorState;
  label: string;
  tone: "negative" | "warning" | "neutral";
  hint: string;
  retryWorthwhile: PaidStructuredSyncRetryHint;
};

type ErrJson = {
  hadAuth?: boolean;
  hadThrottle?: boolean;
  partial?: boolean;
  worstHardCategory?: string;
  errors?: Array<{ phase?: string; message?: string; kind?: string }>;
};

function parse(raw: unknown): ErrJson | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ErrJson;
}

function mapCategory(cat: string | undefined): PaidStructuredSyncOperatorState {
  const c = (cat ?? "").toLowerCase();
  if (c === "auth_or_token") return "auth_blocked";
  if (c === "throttled") return "throttled";
  if (c === "partial_data") return "partial_data";
  if (c === "transient_network") return "transient_failure";
  if (c === "not_found") return "not_found";
  return "unknown";
}

/**
 * Derive a single structured state from `last_meta_sync_error_json` (and optional category hints).
 */
export function projectPaidStructuredSyncError(lastMetaSyncErrorJson: unknown): PaidStructuredSyncErrorProjection | null {
  const e = parse(lastMetaSyncErrorJson);
  if (!e) return null;

  if (e.hadAuth === true) {
    return {
      state: "auth_blocked",
      label: "Access blocked",
      tone: "negative",
      hint: "Meta rejected the Marketing API token or permissions. Fix OAuth or META_MARKETING_ACCESS_TOKEN before retrying.",
      retryWorthwhile: "unlikely",
    };
  }
  if (e.hadThrottle === true) {
    return {
      state: "throttled",
      label: "Rate limited",
      tone: "warning",
      hint: "Meta throttled this request. Wait and retry; scheduled sync also backs off per ad account.",
      retryWorthwhile: "later",
    };
  }

  const cat = mapCategory(e.worstHardCategory);
  if (cat === "partial_data" || (e.partial === true && (e.errors?.length ?? 0) > 0)) {
    return {
      state: "partial_data",
      label: "Partial sync",
      tone: "warning",
      hint:
        e.errors?.[0]?.message?.slice(0, 200) ??
        "Some Graph phases failed; other objects may still have been read.",
      retryWorthwhile: "later",
    };
  }

  switch (cat) {
    case "transient_failure":
      return {
        state: "transient_failure",
        label: "Temporary error",
        tone: "warning",
        hint: e.errors?.[0]?.message?.slice(0, 200) ?? "Transient network or server error from Meta.",
        retryWorthwhile: "later",
      };
    case "not_found":
      return {
        state: "not_found",
        label: "Object missing",
        tone: "negative",
        hint: e.errors?.[0]?.message?.slice(0, 200) ?? "Meta reported a missing or invalid object id.",
        retryWorthwhile: "unlikely",
      };
    default:
      if ((e.errors?.length ?? 0) === 0) return null;
      return {
        state: "unknown",
        label: "Sync issue",
        tone: "negative",
        hint: e.errors![0]?.message?.slice(0, 200) ?? "Last sync reported errors.",
        retryWorthwhile: "later",
      };
  }
}

/** Narrow helper for audit / worker (category-only). */
export function worstCategoryToStructuredState(cat: PaidMetaSyncFailureCategory | null | undefined): PaidStructuredSyncOperatorState | null {
  if (!cat) return null;
  return mapCategory(cat);
}
