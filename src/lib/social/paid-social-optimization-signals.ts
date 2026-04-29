/**
 * Lightweight, explainable optimization hints from latest paid snapshot only (Parts 53–54).
 * No ML; uses normalized metrics already stored — never invents numbers.
 * Dedupe keeps the UI compact when conditions overlap (Part 54).
 */

import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";
import {
  getPaidSocialOptimizationSignalConfig,
  type PaidSocialOptimizationSignalConfig,
} from "@/lib/social/paid-social-optimization-signal-config";

export type PaidOptimizationSignalCode =
  | "no_impressions_after_launch"
  | "spend_without_clicks"
  | "low_ctr"
  | "active_but_no_delivery";

export type PaidOptimizationSignal = {
  code: PaidOptimizationSignalCode;
  label: string;
  hint: string;
};

/** Lower number = higher priority for list summary and stable sort (Part 54). */
export const PAID_OPTIMIZATION_SIGNAL_PRIORITY: Record<PaidOptimizationSignalCode, number> = {
  no_impressions_after_launch: 1,
  active_but_no_delivery: 2,
  spend_without_clicks: 3,
  low_ctr: 4,
};

export type PaidListSignalsSummary = {
  /** Drafts with at least one signal after dedupe. */
  draftCountWithSignals: number;
  /** Label of the highest-priority signal across all drafts, or null. */
  topPrioritySignalLabel: string | null;
};

function pushUnique(list: PaidOptimizationSignal[], s: PaidOptimizationSignal) {
  if (!list.some((x) => x.code === s.code)) list.push(s);
}

/**
 * Remove overlapping signals that add little extra operator value (Part 54).
 * - Zero-impression delivery signals suppress spend_without_clicks and low_ctr (delivery not established).
 * - spend_without_clicks suppresses low_ctr (clicks are zero; CTR is misleading).
 */
export function dedupePaidOptimizationSignals(signals: PaidOptimizationSignal[]): PaidOptimizationSignal[] {
  const codes = new Set(signals.map((s) => s.code));
  const hasNoDelivery =
    codes.has("no_impressions_after_launch") || codes.has("active_but_no_delivery");

  let next = signals.filter((s) => {
    if (hasNoDelivery && (s.code === "low_ctr" || s.code === "spend_without_clicks")) return false;
    return true;
  });

  const hasSpendNoClicks = next.some((s) => s.code === "spend_without_clicks");
  if (hasSpendNoClicks) {
    next = next.filter((s) => s.code !== "low_ctr");
  }

  return [...next].sort(
    (a, b) =>
      (PAID_OPTIMIZATION_SIGNAL_PRIORITY[a.code] ?? 99) - (PAID_OPTIMIZATION_SIGNAL_PRIORITY[b.code] ?? 99)
  );
}

export function computePaidListSignalsSummary(
  campaigns: { paidOptimizationSignals?: PaidOptimizationSignal[] }[]
): PaidListSignalsSummary {
  const withSig = campaigns.filter((c) => (c.paidOptimizationSignals?.length ?? 0) > 0);
  let bestRank = 99;
  let topPrioritySignalLabel: string | null = null;
  for (const c of campaigns) {
    for (const s of c.paidOptimizationSignals ?? []) {
      const r = PAID_OPTIMIZATION_SIGNAL_PRIORITY[s.code] ?? 99;
      if (r < bestRank) {
        bestRank = r;
        topPrioritySignalLabel = s.label;
      }
    }
  }
  return { draftCountWithSignals: withSig.length, topPrioritySignalLabel };
}

function resolveConfig(overrides?: Partial<PaidSocialOptimizationSignalConfig>): PaidSocialOptimizationSignalConfig {
  const base = getPaidSocialOptimizationSignalConfig();
  return { ...base, ...overrides };
}

export function derivePaidOptimizationSignals(
  args: {
    paidLaunchLifecycle: string;
    metaLaunchStatus?: string;
    remoteMetaCampaignId: string | null;
    lastMetaSyncAt: string | null;
    metaRuntimeStatus: string | null;
    latestPaidMetrics: PaidSocialNormalizedMetrics | null;
  },
  thresholdOverrides?: Partial<PaidSocialOptimizationSignalConfig>
): PaidOptimizationSignal[] {
  const cfg = resolveConfig(thresholdOverrides);
  const raw: PaidOptimizationSignal[] = [];
  const launched =
    args.paidLaunchLifecycle === "launched" ||
    (args.metaLaunchStatus ?? "") === "launched" ||
    Boolean(args.remoteMetaCampaignId?.trim());

  if (!launched) return raw;

  const m = args.latestPaidMetrics;
  const rt = (args.metaRuntimeStatus ?? "").toLowerCase();

  if (
    m &&
    m.spendMinor != null &&
    m.spendMinor >= cfg.spendWithoutClicksMinSpendMinor &&
    m.clicks != null &&
    m.clicks === 0
  ) {
    pushUnique(raw, {
      code: "spend_without_clicks",
      label: "Spend without clicks",
      hint: "Meta reports spend but zero clicks — review creative, audience, and placements in Ads Manager.",
    });
  }

  if (m && m.impressions != null && m.impressions >= cfg.lowCtrMinImpressions) {
    let ctr: number | null = m.ctr;
    if (ctr == null && m.clicks != null && m.impressions > 0) {
      ctr = m.clicks / m.impressions;
    }
    if (ctr != null && ctr < cfg.lowCtrThreshold) {
      pushUnique(raw, {
        code: "low_ctr",
        label: "Very low CTR",
        hint: "Click-through rate is low relative to impressions — consider creative or targeting adjustments.",
      });
    }
  }

  const hasSynced = Boolean(args.lastMetaSyncAt);
  if (m && hasSynced && m.impressions === 0) {
    if (rt === "active" || rt === "learning") {
      pushUnique(raw, {
        code: "active_but_no_delivery",
        label: "Active delivery, zero impressions",
        hint: "Meta runtime looks active but the latest snapshot still shows no impressions — check budgets, learning phase, and ad set status.",
      });
    } else {
      pushUnique(raw, {
        code: "no_impressions_after_launch",
        label: "No impressions in latest snapshot",
        hint: "The latest synced metrics show zero impressions — confirm budgets, schedules, and delivery status in Meta.",
      });
    }
  }

  return dedupePaidOptimizationSignals(raw);
}
