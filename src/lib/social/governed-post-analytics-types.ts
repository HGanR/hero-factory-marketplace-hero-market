/**
 * Normalized social performance read model for governed `campaign_posts` (Revenue OS).
 * Provider fetches are mapped here before storage — UI should consume this shape, not raw Graph responses.
 */

import type { PlatformPerformanceSnapshot } from "@/lib/social/platform-performance-sync-contract";

export const SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION = 1 as const;

/** Cross-provider field names; omit keys when unknown — do not fabricate zeros. */
export type NormalizedSocialPostMetrics = {
  impressions?: number | null;
  reach?: number | null;
  clicks?: number | null;
  /** Likes / reactions depending on network semantics. */
  reactions?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  videoViews?: number | null;
  /** Platform-defined composite when provided (not comparable across networks). */
  engagementsTotal?: number | null;
};

export type SocialPostAnalyticsSnapshotPayload = {
  version: typeof SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION;
  normalized: NormalizedSocialPostMetrics;
  /** Exact adapter output at fetch time (auditable; includes nulls). */
  platformSnapshot: PlatformPerformanceSnapshot;
  /** Operator-facing caveats (permissions, proxy fields, etc.). */
  sourceNotes: string[];
  /** When cross-provider comparison would mislead. */
  comparatorCaveat?: string;
};

export type SocialPostAnalyticsAvailabilityCode =
  | "ready"
  | "not_published"
  | "missing_external_post_id"
  | "provider_unsupported"
  | "never_synced"
  | "adapter_stub"
  | "no_adapter";

export type SocialPostAnalyticsPublic = {
  availability: {
    code: SocialPostAnalyticsAvailabilityCode;
    message: string;
    /** Extra context (e.g. unsupported reason, last error). */
    detail?: string | null;
  };
  metricSyncSupport: "live" | "stub_unsupported" | "no_adapter";
  latest: null | {
    id: string;
    campaignPostId: string;
    provider: string;
    providerPostId: string | null;
    snapshotType: string;
    fetchedAt: string;
    metrics: NormalizedSocialPostMetrics;
    sourceNotes: string[];
    comparatorCaveat?: string;
  };
  /** Newest-first, capped for API payloads. */
  recentSnapshots: Array<{
    id: string;
    fetchedAt: string;
    snapshotType: string;
  }>;
};

export type RefreshGovernedPostAnalyticsResult =
  | {
      ok: true;
      snapshot: {
        id: string;
        fetchedAt: string;
        metrics: NormalizedSocialPostMetrics;
        sourceNotes: string[];
        comparatorCaveat?: string;
      };
    }
  | {
      ok: false;
      code:
        | "not_published"
        | "missing_external_post_id"
        | "provider_unsupported"
        | "no_account"
        | "fetch_error"
        | "not_found"
        | "forbidden";
      message: string;
      detail?: string | null;
    };
