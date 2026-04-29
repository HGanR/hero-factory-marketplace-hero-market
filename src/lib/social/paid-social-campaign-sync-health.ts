/**
 * Operator-facing sync health vs launch lifecycle vs runtime (Part 51).
 */

import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";

export type PaidSyncHealthTone = "neutral" | "positive" | "warning" | "negative" | "muted";

export type PaidSyncHealth = {
  label: string;
  tone: PaidSyncHealthTone;
  hint: string;
};

type SyncErrorShape = {
  hadAuth?: boolean;
  hadThrottle?: boolean;
  worstHardCategory?: string;
  partial?: boolean;
  errors?: Array<{ phase?: string; message?: string; kind?: string }>;
};

function parseSyncError(raw: unknown): SyncErrorShape | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as SyncErrorShape;
}

/** One-line operator copy from `lastMetaSyncErrorJson` (Part 51). */
export function formatPaidMetaSyncErrorSummary(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.hadAuth === true) {
    return "Meta rejected credentials or permissions (OAuth or Marketing API token).";
  }
  if (o.hadThrottle === true) {
    return "Meta rate-limited this sync. Retry later; scheduled jobs back off automatically.";
  }
  const errs = o.errors;
  if (Array.isArray(errs) && errs.length > 0) {
    const first = errs[0] as Record<string, unknown>;
    const phase = typeof first.phase === "string" ? first.phase.replace(/_/g, " ") : "sync";
    const msg = typeof first.message === "string" ? first.message.slice(0, 180) : "";
    const partial = o.partial === true ? " Some objects were still read." : "";
    return `${phase}: ${msg || "Request failed"}.${partial}`.trim();
  }
  const cat = o.worstHardCategory;
  if (typeof cat === "string" && cat) {
    return `Last sync issue: ${cat.replace(/_/g, " ")}.`;
  }
  return null;
}

export function derivePaidSyncHealth(args: {
  metaLaunchFeatureEnabled: boolean;
  paidLaunchLifecycle: string;
  remoteMetaCampaignId: string | null;
  lastMetaSyncAt: string | null;
  lastMetaSyncError: unknown;
  metaRuntimeStatus: string | null;
  latestPaidMetrics: PaidSocialNormalizedMetrics | null;
  latestSnapshotMeta: {
    metricsCompleteness?: string;
    sourceNotes?: string[];
    insightsSource?: string | null;
    usedFallbackInsights?: boolean;
  } | null;
}): PaidSyncHealth {
  if (!args.metaLaunchFeatureEnabled) {
    return {
      label: "Sync off",
      tone: "muted",
      hint: "Enable PAID_SOCIAL_META_ADS_EXECUTION_ENABLED to sync delivery state from Meta.",
    };
  }

  const launched =
    args.paidLaunchLifecycle === "launched" || Boolean(args.remoteMetaCampaignId?.trim());

  if (!launched) {
    return {
      label: "Pre-sync",
      tone: "neutral",
      hint: "Launch to Meta first; sync reads delivery after remote objects exist.",
    };
  }

  const err = parseSyncError(args.lastMetaSyncError);
  if (err?.hadAuth) {
    return {
      label: "Token / access",
      tone: "negative",
      hint: "Meta rejected the Marketing API token or permissions. Refresh OAuth or META_MARKETING_ACCESS_TOKEN.",
    };
  }
  if (err?.hadThrottle) {
    return {
      label: "Throttled",
      tone: "warning",
      hint: "Meta rate-limited recent requests. Scheduled sync backs off automatically; retry later.",
    };
  }

  if (!args.lastMetaSyncAt) {
    return {
      label: "Never synced",
      tone: "warning",
      hint: "Use “Sync from Meta” to pull delivery status. Scheduled job also refreshes stale rows.",
    };
  }

  if (err?.partial && err.errors?.length) {
    const first = err.errors[0]?.message?.slice(0, 120) ?? "Some Graph phases failed.";
    return {
      label: "Partial sync",
      tone: "warning",
      hint: first,
    };
  }

  if (err && !err.partial && err.errors?.length) {
    return {
      label: "Sync failed",
      tone: "negative",
      hint: err.errors[0]?.message?.slice(0, 160) ?? "Last sync could not read Meta objects.",
    };
  }

  const rt = (args.metaRuntimeStatus ?? "").toLowerCase();
  if (rt === "paused") {
    return {
      label: "Paused (Meta)",
      tone: "neutral",
      hint: "Objects exist but delivery is paused in Ads Manager.",
    };
  }
  if (rt === "rejected" || rt === "limited") {
    return {
      label: rt === "rejected" ? "Disapproved" : "Limited delivery",
      tone: "warning",
      hint: "Review Meta effective status and policy issues in Ads Manager.",
    };
  }

  if (args.latestSnapshotMeta?.usedFallbackInsights || args.latestSnapshotMeta?.insightsSource === "adset") {
    return {
      label: "Partial metrics",
      tone: "warning",
      hint:
        args.latestSnapshotMeta.sourceNotes?.[0] ??
        "Latest snapshot uses ad set or campaign-level insights (not ad-level).",
    };
  }

  if (
    args.latestSnapshotMeta?.metricsCompleteness === "partial_early_delivery" &&
    !args.latestPaidMetrics?.impressions &&
    !args.latestPaidMetrics?.clicks &&
    !args.latestPaidMetrics?.spendMinor
  ) {
    return {
      label: "Live, metrics pending",
      tone: "neutral",
      hint:
        args.latestSnapshotMeta.sourceNotes?.[0] ??
        "Meta objects are reachable; lifetime metrics often appear after delivery starts.",
    };
  }

  if (args.latestPaidMetrics && (args.latestPaidMetrics.impressions != null || args.latestPaidMetrics.spendMinor != null)) {
    return {
      label: "Synced",
      tone: "positive",
      hint: "Latest snapshot includes reported lifetime metrics from Meta.",
    };
  }

  return {
    label: "Synced (no metrics row)",
    tone: "neutral",
    hint: "Last read succeeded but no numeric snapshot yet — common right after launch.",
  };
}
