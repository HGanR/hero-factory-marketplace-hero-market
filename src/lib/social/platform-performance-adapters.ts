import type { SocialPlatform } from "@/lib/social/config";
import {
  getMetricSyncAdapterDebugLabel,
  getPlatformPerformanceCapability,
  listAllPlatformPerformanceCapabilities,
} from "@/lib/social/platform-performance-adapter-capabilities";
import type {
  PlatformPerformanceSnapshot,
  PlatformPostPerformanceFetchStatus,
  PlatformMetricSyncSupportState,
} from "@/lib/social/platform-performance-sync-contract";
import { fetchInstagramPostPerformanceSnapshot } from "@/lib/social/adapters/instagram-post-performance";
import { fetchLinkedInPostPerformanceSnapshot } from "@/lib/social/adapters/linkedin-post-performance";

export function getPlatformMetricSyncSupportState(platform: string): PlatformMetricSyncSupportState {
  const p = platform.toLowerCase() as SocialPlatform;
  const cap = getPlatformPerformanceCapability(p);
  if (cap.metricSyncImplementation === "live") return "live";
  if (cap.metricSyncImplementation === "stub") return "stub_unsupported";
  return "no_adapter";
}

export function buildPlatformMetricSyncSupportMap(): Record<SocialPlatform, PlatformMetricSyncSupportState> {
  const out = {} as Record<SocialPlatform, PlatformMetricSyncSupportState>;
  for (const c of listAllPlatformPerformanceCapabilities()) {
    out[c.platform] = getPlatformMetricSyncSupportState(c.platform);
  }
  return out;
}

export async function fetchPlatformPostPerformanceSnapshot(args: {
  platform: string;
  accessToken: string;
  externalPostId: string;
}): Promise<PlatformPostPerformanceFetchStatus> {
  const p = args.platform.toLowerCase() as SocialPlatform;
  const token = args.accessToken.trim();
  const ext = args.externalPostId.trim();
  if (!token || !ext) {
    return { status: "error", message: "Missing access token or external post id for metric sync." };
  }

  if (p === "instagram") {
    return fetchInstagramPostPerformanceSnapshot({ accessToken: token, externalPostId: ext });
  }
  if (p === "linkedin") {
    return fetchLinkedInPostPerformanceSnapshot({ accessToken: token, externalPostId: ext });
  }

  const cap = getPlatformPerformanceCapability(p);
  if (cap.metricSyncImplementation === "none" || cap.metricSyncImplementation === "stub") {
    return {
      status: "unsupported",
      reason: `Metric sync not implemented for platform "${args.platform}" (${getMetricSyncAdapterDebugLabel(p)} adapter).`,
    };
  }

  return {
    status: "unsupported",
    reason: `No live metric adapter wired for platform "${args.platform}".`,
  };
}

export type { PlatformPerformanceSnapshot };
