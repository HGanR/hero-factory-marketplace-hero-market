/**
 * Paid social campaign lifecycle + Meta runtime status (Part 50).
 * `meta_launch_status` remains the DB source for launch; this module maps to operator-facing states.
 */

export type PaidLaunchLifecycle =
  | "draft"
  | "ready"
  | "launch_requested"
  | "launched"
  | "launch_failed";

export type PaidMetaRuntimeStatus =
  | "active"
  | "paused"
  | "learning"
  | "limited"
  | "rejected"
  | "unknown";

const RUNTIME_LABELS: Record<PaidMetaRuntimeStatus, string> = {
  active: "Active in Meta",
  paused: "Paused / not delivering",
  learning: "In review or processing",
  limited: "Limited delivery or issues",
  rejected: "Disapproved or rejected",
  unknown: "Status unknown — sync again",
};

const LAUNCH_LABELS: Record<PaidLaunchLifecycle, string> = {
  draft: "Draft (not ready to launch)",
  ready: "Ready to launch",
  launch_requested: "Launch in progress",
  launched: "Launched to Meta",
  launch_failed: "Launch failed",
};

/**
 * Map stored `meta_launch_status` + structural readiness + remote ids to a stable launch lifecycle label.
 */
export function derivePaidLaunchLifecycle(args: {
  metaLaunchStatus: string;
  remoteMetaCampaignId: string | null;
  structurallyComplete: boolean;
}): PaidLaunchLifecycle {
  const st = (args.metaLaunchStatus ?? "idle").toLowerCase();
  const hasRemote = Boolean(args.remoteMetaCampaignId?.trim());

  if (st === "failed") return "launch_failed";
  if (st === "launching") return "launch_requested";
  if (st === "launched" || hasRemote) return "launched";
  if (args.structurallyComplete) return "ready";
  return "draft";
}

/**
 * Map Meta Ad API `effective_status` / `status` strings to internal runtime (best-effort).
 * @see https://developers.facebook.com/docs/marketing-api/reference/adgroup
 */
export function mapMetaAdEffectiveStatusToRuntime(effectiveStatus?: string | null, configuredStatus?: string | null): PaidMetaRuntimeStatus {
  const eff = (effectiveStatus ?? "").toUpperCase().trim();
  const cfg = (configuredStatus ?? "").toUpperCase().trim();
  const primary = eff || cfg;

  if (!primary) return "unknown";

  if (primary === "ACTIVE") return "active";

  if (
    primary === "PAUSED" ||
    primary === "CAMPAIGN_PAUSED" ||
    primary === "ADSET_PAUSED" ||
    primary === "ARCHIVED" ||
    primary === "DELETED"
  ) {
    return "paused";
  }

  if (primary === "DISAPPROVED") return "rejected";

  if (primary === "WITH_ISSUES") return "limited";

  if (
    primary === "IN_PROCESS" ||
    primary === "PENDING_REVIEW" ||
    primary === "PREAPPROVED" ||
    primary === "PENDING_BILLING_INFO"
  ) {
    return "learning";
  }

  return "unknown";
}

/** Prefer ad effective status; fall back to campaign configured status. */
export function deriveRuntimeFromMetaStatusBundle(bundle: {
  ad?: { effective_status?: string; status?: string } | null;
  campaign?: { effective_status?: string; status?: string } | null;
  adset?: { effective_status?: string; status?: string } | null;
}): PaidMetaRuntimeStatus {
  if (bundle.ad?.effective_status || bundle.ad?.status) {
    return mapMetaAdEffectiveStatusToRuntime(bundle.ad.effective_status, bundle.ad.status);
  }
  if (bundle.adset?.effective_status || bundle.adset?.status) {
    return mapMetaAdEffectiveStatusToRuntime(bundle.adset.effective_status, bundle.adset.status);
  }
  if (bundle.campaign?.effective_status || bundle.campaign?.status) {
    return mapMetaAdEffectiveStatusToRuntime(bundle.campaign.effective_status, bundle.campaign.status);
  }
  return "unknown";
}

export function paidMetaRuntimeStatusLabel(s: PaidMetaRuntimeStatus | string | null | undefined): string {
  if (!s) return RUNTIME_LABELS.unknown;
  const k = s as PaidMetaRuntimeStatus;
  return RUNTIME_LABELS[k] ?? RUNTIME_LABELS.unknown;
}

export function paidLaunchLifecycleLabel(l: PaidLaunchLifecycle | string): string {
  const k = l as PaidLaunchLifecycle;
  return LAUNCH_LABELS[k] ?? l;
}

export function paidLaunchLifecycleHint(l: PaidLaunchLifecycle): string | null {
  switch (l) {
    case "draft":
      return "Complete objective, budget, destination, placements, and creative.";
    case "ready":
      return "When the Meta launch flag is on, use Launch to create PAUSED objects in Ads Manager.";
    case "launch_requested":
      return "Wait for launch to finish; avoid double-submitting.";
    case "launched":
      return "Use Sync to refresh delivery status and metrics from Meta.";
    case "launch_failed":
      return "Fix errors shown below and try launching again if remote objects were not created.";
    default:
      return null;
  }
}
