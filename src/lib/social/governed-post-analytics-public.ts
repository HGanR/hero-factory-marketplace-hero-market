import type { CampaignPostRow } from "@/lib/db/schema";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import type {
  SocialPostAnalyticsPublic,
  SocialPostAnalyticsSnapshotPayload,
} from "@/lib/social/governed-post-analytics-types";
import type { AnalyticsSnapshotRow } from "@/lib/social/governed-post-analytics-store";
import { getPlatformMetricSyncSupportState } from "@/lib/social/platform-performance-adapters";
import type { SocialPlatform } from "@/lib/social/config";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { listRecentSnapshotsForPost } from "@/lib/social/governed-post-analytics-store";
import {
  formatAnalyticsSummaryLine,
  parseStoredAnalyticsPayload,
} from "@/lib/social/governed-post-analytics-normalize";

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

function buildLatestFromRow(
  head: AnalyticsSnapshotRow,
  parsed: SocialPostAnalyticsSnapshotPayload
): NonNullable<SocialPostAnalyticsPublic["latest"]> {
  return {
    id: head.id,
    campaignPostId: head.campaignPostId,
    provider: head.provider,
    providerPostId: head.providerPostId,
    snapshotType: head.snapshotType,
    fetchedAt: iso(head.fetchedAt) ?? "",
    metrics: parsed.normalized,
    sourceNotes: parsed.sourceNotes,
    comparatorCaveat: parsed.comparatorCaveat,
  };
}

/**
 * Build the analytics attachment for GET post / GET analytics (no provider calls).
 */
export async function buildSocialPostAnalyticsPublic(
  db: SocialPostTimelineDb,
  post: CampaignPostRow,
  opts?: { historyLimit?: number }
): Promise<SocialPostAnalyticsPublic> {
  const platformKey = normalizeCampaignPostPlatformForPublish(post.platform);
  const support = platformKey ? getPlatformMetricSyncSupportState(platformKey) : "no_adapter";
  const historyLimit = opts?.historyLimit ?? 8;
  const st = String(post.status || "").toUpperCase();

  if (st !== "POSTED") {
    return {
      availability: {
        code: "not_published",
        message: "Analytics refresh runs after the post is published.",
      },
      metricSyncSupport: support,
      latest: null,
      recentSnapshots: [],
    };
  }

  const recentRows = await listRecentSnapshotsForPost(db, { campaignPostId: post.id, limit: historyLimit });
  const recentSnapshots = recentRows.map((r) => ({
    id: r.id,
    fetchedAt: iso(r.fetchedAt) ?? "",
    snapshotType: r.snapshotType,
  }));

  const head = recentRows[0];
  const parsed = head ? parseStoredAnalyticsPayload(head.metricsJson) : null;
  const latest = head && parsed ? buildLatestFromRow(head, parsed) : null;

  if (!platformKey) {
    return {
      availability: {
        code: "provider_unsupported",
        message: "This platform is not recognized for governed analytics.",
      },
      metricSyncSupport: "no_adapter",
      latest,
      recentSnapshots,
    };
  }

  if (support === "no_adapter") {
    return {
      availability: {
        code: latest ? "ready" : "no_adapter",
        message: latest
          ? "Showing the last stored snapshot. Live refresh is not wired for this provider in this deployment."
          : `${platformKey} does not have a metric sync adapter yet (e.g. Facebook publish without insights fetch).`,
        detail: latest ? "New refreshes will not call a provider API until an adapter exists." : null,
      },
      metricSyncSupport: support,
      latest,
      recentSnapshots,
    };
  }

  if (support === "stub_unsupported") {
    return {
      availability: {
        code: latest ? "ready" : "adapter_stub",
        message: latest
          ? "Stored snapshot only — metric sync is stubbed for this provider."
          : "Metric sync is declared but not implemented for this provider.",
      },
      metricSyncSupport: support,
      latest,
      recentSnapshots,
    };
  }

  const ext = post.platformPostId?.trim();
  if (!ext) {
    return {
      availability: {
        code: "missing_external_post_id",
        message: "No remote post id on file — re-publish or check publish outcome so `platform_post_id` is set.",
        detail: latest ? "An older snapshot may still display if one exists." : null,
      },
      metricSyncSupport: support,
      latest,
      recentSnapshots,
    };
  }

  if (!latest) {
    return {
      availability: {
        code: "never_synced",
        message: "No snapshot yet — use Refresh metrics when the post is live on the network.",
      },
      metricSyncSupport: support,
      latest: null,
      recentSnapshots,
    };
  }

  return {
    availability: {
      code: "ready",
      message: "Latest snapshot loaded. Metrics are provider-specific; read source notes before comparing providers.",
    },
    metricSyncSupport: support,
    latest,
    recentSnapshots,
  };
}

export function plannerAnalyticsHint(args: {
  post: CampaignPostRow;
  latestRow: { metricsJson: unknown; fetchedAt: Date | string } | null | undefined;
}): string | null {
  const st = String(args.post.status || "").toUpperCase();
  if (st !== "POSTED") return null;

  const platformKey = normalizeCampaignPostPlatformForPublish(args.post.platform);
  if (!platformKey) return null;

  const support = getPlatformMetricSyncSupportState(platformKey as SocialPlatform);
  if (support !== "live") {
    if (platformKey === "facebook") {
      return "Metrics: Facebook insights fetch not wired yet";
    }
    return "Metrics: sync not available for this provider";
  }

  if (!args.post.platformPostId?.trim()) {
    return "Metrics: missing remote post id";
  }

  if (!args.latestRow) {
    return "Metrics: not synced yet";
  }

  const parsed = parseStoredAnalyticsPayload(args.latestRow.metricsJson);
  if (!parsed) return "Metrics: not synced yet";

  const fetchedAt =
    args.latestRow.fetchedAt instanceof Date ? args.latestRow.fetchedAt.toISOString() : String(args.latestRow.fetchedAt);
  return formatAnalyticsSummaryLine({ normalized: parsed.normalized, fetchedAtIso: fetchedAt });
}
