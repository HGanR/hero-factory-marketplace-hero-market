/**
 * Lightweight paid rollup: sum **latest** snapshot per paid draft in a governed campaign (Part 51).
 * Does not mix with organic `campaign_post_analytics_snapshots`.
 */

import { getLatestPaidSocialAnalyticsSnapshot } from "@/lib/social/paid-social-analytics-store";
import { listPaidSocialCampaignsByCampaign } from "@/lib/social/paid-social-campaigns";
import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PaidSocialCampaignRollup = {
  /** Draft rows in this campaign (any provider). */
  paidDraftCount: number;
  /** Sum of latest-snapshot impressions where present. */
  impressions: number | null;
  clicks: number | null;
  spendMinor: number | null;
  /** Representative currency from first row (drafts share campaign context). */
  currency: string;
  /** How many drafts contributed a numeric field to each total. */
  contributors: { impressions: number; clicks: number; spendMinor: number };
};

export async function computePaidSocialRollupForCampaign(db: Db, campaignId: string): Promise<PaidSocialCampaignRollup | null> {
  const rows = await listPaidSocialCampaignsByCampaign(db, campaignId);
  if (rows.length === 0) return null;

  let currency = "USD";
  let impSum = 0,
    clkSum = 0,
    spendSum = 0;
  let ci = 0,
    cc = 0,
    cs = 0;

  for (const r of rows) {
    if (r.currency?.trim()) currency = String(r.currency).trim();
    const snap = await getLatestPaidSocialAnalyticsSnapshot(db, r.id);
    if (!snap?.metricsJson || typeof snap.metricsJson !== "object") continue;
    const mj = snap.metricsJson as Record<string, unknown>;
    const n = mj.normalized as PaidSocialNormalizedMetrics | undefined;
    if (!n || typeof n !== "object") continue;
    if (n.impressions != null && Number.isFinite(n.impressions)) {
      impSum += n.impressions;
      ci++;
    }
    if (n.clicks != null && Number.isFinite(n.clicks)) {
      clkSum += n.clicks;
      cc++;
    }
    if (n.spendMinor != null && Number.isFinite(n.spendMinor)) {
      spendSum += n.spendMinor;
      cs++;
    }
  }

  return {
    paidDraftCount: rows.length,
    impressions: ci > 0 ? impSum : null,
    clicks: cc > 0 ? clkSum : null,
    spendMinor: cs > 0 ? spendSum : null,
    currency,
    contributors: { impressions: ci, clicks: cc, spendMinor: cs },
  };
}
