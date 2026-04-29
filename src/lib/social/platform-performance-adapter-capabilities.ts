/**
 * Declared capabilities for publish vs metric-sync (per platform).
 * Used by UI, Bentley copy, and debug — keep in sync with `platform-performance-adapters.ts` behavior.
 */

import { PLATFORM_CONFIG, type SocialPlatform } from "@/lib/social/config";
import { adapters } from "@/lib/social/adapters";

/** Metric sync wiring (actual fetch behavior lives in platform-performance-adapters). */
export type MetricSyncImplementationKind = "live" | "stub" | "none";

export type PlatformPerformanceAdapterCapability = {
  platform: SocialPlatform;
  supportsPublish: boolean;
  supportsMetricSync: boolean;
  metricSyncImplementation: MetricSyncImplementationKind;
  /** Fields we may populate from real APIs when sync succeeds. */
  metricFieldsLikelyAvailable: string[];
  authConstraints: string[];
  /** Lower = implement first (feasibility × value). */
  implementationPriority: number;
  /** How remote post id is stored on `campaign_posts.platform_post_id` after publish. */
  remotePostIdNotes: string;
};

/**
 * Order platforms should receive real metric adapters:
 * 1. Instagram — Graph `ig-media` id returned from `media_publish`; same Page token can call `/insights`.
 * 2. LinkedIn — `X-Restli-Id` URN stored; `GET /rest/socialActions/{ugcPostUrn}` for like/comment counts (not impressions) with **w_member_social**.
 * 3. Others — follow when publish adapters exist.
 */
export const RECOMMENDED_METRIC_SYNC_IMPLEMENTATION_ORDER: SocialPlatform[] = [
  "instagram",
  "linkedin",
  "facebook",
  "tiktok",
  "pinterest",
  "snapchat",
  "x",
];

const CAPABILITIES: Record<SocialPlatform, PlatformPerformanceAdapterCapability> = {
  instagram: {
    platform: "instagram",
    supportsPublish: Boolean(adapters.instagram),
    supportsMetricSync: true,
    metricSyncImplementation: "live",
    metricFieldsLikelyAvailable: [
      "impressions (when API exposes)",
      "reach",
      "saved",
      "likes (like_count)",
      "comments_count",
      "engagement (composite or insights)",
      "video_views (video/reels when permitted)",
    ],
    authConstraints: [
      "Graph user token with access to the IG user; insights often require instagram_manage_insights or effective Page permissions — missing scope returns a normalized Graph error, not fabricated metrics.",
    ],
    implementationPriority: 1,
    remotePostIdNotes:
      "After media_publish, `platform_post_id` holds the Instagram media id (numeric) used for `/insights` and field queries.",
  },
  linkedin: {
    platform: "linkedin",
    supportsPublish: Boolean(adapters.linkedin),
    supportsMetricSync: true,
    metricSyncImplementation: "live",
    metricFieldsLikelyAvailable: [
      "likes (socialActions likesSummary)",
      "comments (socialActions commentsSummary)",
      "engagement (likes + comments composite; no impression fabrication)",
    ],
    authConstraints: [
      "REST `GET /rest/socialActions/{urn}` requires **LinkedIn-Version** + token with **w_member_social** (default app scope). Impressions are not exposed here — we leave them null.",
    ],
    implementationPriority: 2,
    remotePostIdNotes:
      "After ugcPosts, `platform_post_id` stores the URN from `X-RestLi-Id` (typically `urn:li:ugcPost:{id}`) used for socialActions metric sync.",
  },
  facebook: {
    platform: "facebook",
    supportsPublish: false,
    supportsMetricSync: false,
    metricSyncImplementation: "none",
    metricFieldsLikelyAvailable: [],
    authConstraints: ["Publish adapter not implemented; metrics would use Page insights when available."],
    implementationPriority: 5,
    remotePostIdNotes: "—",
  },
  tiktok: {
    platform: "tiktok",
    supportsPublish: false,
    supportsMetricSync: false,
    metricSyncImplementation: "none",
    metricFieldsLikelyAvailable: [],
    authConstraints: ["No publish adapter in app yet."],
    implementationPriority: 6,
    remotePostIdNotes: "—",
  },
  pinterest: {
    platform: "pinterest",
    supportsPublish: false,
    supportsMetricSync: false,
    metricSyncImplementation: "none",
    metricFieldsLikelyAvailable: [],
    authConstraints: ["No publish adapter in app yet."],
    implementationPriority: 7,
    remotePostIdNotes: "—",
  },
  snapchat: {
    platform: "snapchat",
    supportsPublish: false,
    supportsMetricSync: false,
    metricSyncImplementation: "none",
    metricFieldsLikelyAvailable: [],
    authConstraints: ["No publish adapter in app yet."],
    implementationPriority: 8,
    remotePostIdNotes: "—",
  },
  x: {
    platform: "x",
    supportsPublish: false,
    supportsMetricSync: false,
    metricSyncImplementation: "none",
    metricFieldsLikelyAvailable: [],
    authConstraints: ["X OAuth disabled in config until client credentials are provided."],
    implementationPriority: 9,
    remotePostIdNotes: "—",
  },
};

export function getPlatformPerformanceCapability(platform: SocialPlatform): PlatformPerformanceAdapterCapability {
  return CAPABILITIES[platform];
}

export function listAllPlatformPerformanceCapabilities(): PlatformPerformanceAdapterCapability[] {
  return (Object.keys(CAPABILITIES) as SocialPlatform[]).map((p) => CAPABILITIES[p]);
}

/** Adapter implementation label for debug panels. */
export function getMetricSyncAdapterDebugLabel(platform: SocialPlatform): "real" | "stub" | "none" {
  const c = CAPABILITIES[platform];
  if (c.metricSyncImplementation === "live") return "real";
  if (c.metricSyncImplementation === "stub") return "stub";
  return "none";
}

export function buildMetricSyncCapabilitySummary(): {
  firstImplementationTarget: SocialPlatform;
  narrativeLines: string[];
} {
  const first = RECOMMENDED_METRIC_SYNC_IMPLEMENTATION_ORDER[0];
  const lines: string[] = [];
  const live = listAllPlatformPerformanceCapabilities().filter((c) => c.metricSyncImplementation === "live");
  if (live.length) {
    lines.push(
      `Real metric sync is wired for: ${live.map((c) => c.platform).join(", ")} (live platform API calls; no fabricated numbers).`
    );
  }
  const stubPublish = listAllPlatformPerformanceCapabilities().filter(
    (c) => c.supportsPublish && c.metricSyncImplementation === "stub"
  );
  for (const c of stubPublish) {
    lines.push(
      `${c.platform}: publishing is supported, but metric sync is not implemented yet (${c.authConstraints[0] ?? "see capabilities doc"}).`
    );
  }
  return { firstImplementationTarget: first, narrativeLines: lines };
}

/** OAuth app enabled flag from env (same as connect UI). */
export function isPlatformOAuthConfigured(platform: SocialPlatform): boolean {
  return PLATFORM_CONFIG[platform]?.enabled === true;
}
