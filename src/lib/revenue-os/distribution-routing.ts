/**
 * Connector-aware routing for bentley_distribution_queue_targets.
 */

import type { SocialPlatform } from "@/lib/social/config";
import type { BentleyDistributionPlan } from "@/lib/revenue-os/market-sweep-schema";
import type {
  DistributionQueueRow,
  DistributionQueueTargetRow,
} from "@/lib/revenue-os/distribution-queue-actions";
import type {
  ConnectedPublishingProfile,
  PublishingCapabilityMatrix,
} from "@/lib/revenue-os/platform-connectors";
import {
  normalizeRoutingPlatform,
  profileForPlatform,
} from "@/lib/revenue-os/platform-connectors";
import {
  transformPayloadForPlatform,
  type UnifiedContentPayload,
} from "@/lib/revenue-os/platform-payload-transformers";

export type ConnectorRoutingStatus =
  | "ready"
  | "blocked_no_connector"
  | "blocked_capability_mismatch"
  | "requires_manual_export";

export type ConnectorCoverageSummary = {
  connectedPlatforms: string[];
  autoPublishReadyCount: number;
  manualFallbackCount: number;
  blockedTargetsCount: number;
  blockedNoConnectorCount: number;
  blockedCapabilityMismatchCount: number;
  requiresManualExportCount: number;
  recommendedConnectorAction: string;
  /** Workspace-level connection summary from the capability matrix. */
  matrixSummaryLine?: string;
};

export type RoutedTargetPlan = {
  targetId: string;
  queueId: string;
  targetPlatform: string;
  targetFormat: string;
  selectedProfileId: string | null;
  routingStatus: ConnectorRoutingStatus;
  payloadJson: Record<string, unknown>;
  routingWarnings: string[];
};

export type DistributionRoutingResult = {
  routedTargets: RoutedTargetPlan[];
  autoPublishReady: number;
  manualFallback: number;
  blockedTargets: Array<{ queueId: string; targetId: string; status: ConnectorRoutingStatus; detail: string }>;
  connectorCoverageSummary: ConnectorCoverageSummary;
};

function unifiedFromTargetPayload(payload: unknown): UnifiedContentPayload {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const hashtags =
    Array.isArray(p.hashtags) ? (p.hashtags as string[])
    : typeof p.hashtags === "string" ? p.hashtags.split(/\s+/).filter(Boolean)
    : [];
  const bodyFrom =
    typeof p.body === "string"
      ? p.body
      : typeof p.angle === "string"
        ? p.angle
        : typeof p.rationale === "string"
          ? p.rationale
          : undefined;
  return {
    title: typeof p.title === "string" ? p.title : undefined,
    caption: typeof p.caption === "string" ? p.caption : undefined,
    body: bodyFrom,
    hashtags,
    cta: typeof p.ctaType === "string" ? p.ctaType : typeof p.cta === "string" ? p.cta : undefined,
    mediaPrompt: typeof p.mediaPrompt === "string" ? p.mediaPrompt : undefined,
    assetRefs: Array.isArray(p.assetRefs) ? (p.assetRefs as string[]) : undefined,
    targetFormat: typeof p.targetFormat === "string" ? p.targetFormat : undefined,
  };
}

function formatHintForQueue(
  queuePlatform: string,
  hints: Array<{ platform: string; format: string; reason: string }> | undefined
): string | undefined {
  if (!hints?.length) return undefined;
  const low = String(queuePlatform ?? "").trim().toLowerCase();
  const m = hints.find((h) => {
    const hp = String(h.platform ?? "").trim().toLowerCase();
    return low.includes(hp) || hp.includes(low);
  });
  return m?.format ?? hints[0]?.format;
}

function isFormatCompatible(
  profile: ConnectedPublishingProfile | null,
  format: string,
  platform: SocialPlatform | "youtube"
): { ok: boolean; reason?: string } {
  const f = (format || "feed").toLowerCase();
  if (!profile) {
    if (platform === "youtube") return { ok: true };
    return { ok: false, reason: "no_profile" };
  }
  if (platform === "tiktok" && ["article", "long", "carousel"].includes(f)) {
    return { ok: false, reason: "tiktok_short_only" };
  }
  if (platform === "instagram" && f === "article") {
    return { ok: false, reason: "instagram_no_article" };
  }
  if (!profile.supportsLongForm && ["article", "long"].includes(f)) {
    return { ok: false, reason: "long_form_not_supported" };
  }
  if (!profile.supportsShortForm && ["reel", "short", "story"].includes(f)) {
    return { ok: false, reason: "short_form_not_supported" };
  }
  return { ok: true };
}

function recommendedAction(matrix: PublishingCapabilityMatrix, blockedNoConn: number): string {
  if (!matrix.profiles.length) {
    return "Connect at least one OAuth social account (Instagram, LinkedIn, Facebook, or TikTok) for direct publishing.";
  }
  if (blockedNoConn > 0 && !matrix.platformsWithAutoPublish.includes("facebook")) {
    return "Best next unlock: connect a Facebook Page for feed publishing, or add the missing platform in Workspace integrations.";
  }
  if (matrix.platformsManualOnly.length) {
    return `Linked accounts on ${matrix.platformsManualOnly.join(", ")} need publish scopes or adapter support — re-authorize or use manual export.`;
  }
  return "Approve and schedule queue items marked ready; use manual export packages for blocked platforms.";
}

export function routeDistributionTargets(input: {
  distributionPlan: BentleyDistributionPlan | null | undefined;
  connectedProfiles: ConnectedPublishingProfile[];
  capabilityMatrix: PublishingCapabilityMatrix;
  queueItems: DistributionQueueRow[];
  targets: DistributionQueueTargetRow[];
  targetPlatformHints?: BentleyDistributionPlan["platformFormatHints"];
  publishingObjective?: string | null;
}): DistributionRoutingResult {
  const matrixSummaryLine = input.capabilityMatrix.summaryLine;
  const hints = input.targetPlatformHints ?? input.distributionPlan?.platformFormatHints;
  const routedTargets: RoutedTargetPlan[] = [];
  const blockedTargets: DistributionRoutingResult["blockedTargets"] = [];
  let autoPublishReady = 0;
  let manualFallback = 0;
  let blockedNoConnector = 0;
  let blockedCapability = 0;
  let requiresManual = 0;

  const targetByQueue = new Map<string, DistributionQueueTargetRow[]>();
  for (const t of input.targets) {
    const list = targetByQueue.get(t.queueId) ?? [];
    list.push(t);
    targetByQueue.set(t.queueId, list);
  }

  for (const q of input.queueItems) {
    const tlist = targetByQueue.get(q.id) ?? [];
    const rows = tlist.length ? tlist : [];
    if (!rows.length) continue;

    const queuePlatform = normalizeRoutingPlatform(q.platform) ?? normalizeRoutingPlatform(rows[0]?.targetPlatform);
    const hintFormat = formatHintForQueue(q.platform || rows[0]?.targetPlatform || "", hints);

    for (const row of rows) {
      const platform = queuePlatform ?? normalizeRoutingPlatform(row.targetPlatform);
      const targetFormat = (hintFormat ?? row.targetFormat ?? "feed").slice(0, 64);
      const basePayload = unifiedFromTargetPayload(row.payloadJson);

      if (!platform) {
        const st: ConnectorRoutingStatus = "blocked_no_connector";
        blockedTargets.push({ queueId: q.id, targetId: row.id, status: st, detail: "unknown_platform" });
        blockedNoConnector++;
        manualFallback++;
        routedTargets.push({
          targetId: row.id,
          queueId: q.id,
          targetPlatform: row.targetPlatform,
          targetFormat,
          selectedProfileId: null,
          routingStatus: st,
          payloadJson: { ...basePayload, routingNote: "unknown platform" },
          routingWarnings: ["Platform label could not be normalized — use manual export."],
        });
        continue;
      }

      if (platform === "youtube") {
        const { payloadJson, warnings } = transformPayloadForPlatform("youtube", {
          ...basePayload,
          targetFormat,
        });
        requiresManual++;
        manualFallback++;
        routedTargets.push({
          targetId: row.id,
          queueId: q.id,
          targetPlatform: "youtube",
          targetFormat,
          selectedProfileId: null,
          routingStatus: "requires_manual_export",
          payloadJson,
          routingWarnings: [
            ...warnings,
            "YouTube is not OAuth-linked in this workspace — package for manual upload.",
          ],
        });
        continue;
      }

      const profile = profileForPlatform(input.connectedProfiles, platform);
      if (!profile) {
        const st: ConnectorRoutingStatus = "blocked_no_connector";
        blockedNoConnector++;
        manualFallback++;
        const { payloadJson, warnings } = transformPayloadForPlatform(platform, { ...basePayload, targetFormat });
        blockedTargets.push({ queueId: q.id, targetId: row.id, status: st, detail: "no_connector" });
        routedTargets.push({
          targetId: row.id,
          queueId: q.id,
          targetPlatform: platform,
          targetFormat,
          selectedProfileId: null,
          routingStatus: st,
          payloadJson,
          routingWarnings: [
            ...warnings,
            `No connected ${platform} account — connect OAuth or use manual export.`,
          ],
        });
        continue;
      }

      const compat = isFormatCompatible(profile, targetFormat, platform);
      if (!compat.ok) {
        blockedCapability++;
        manualFallback++;
        const { payloadJson, warnings } = transformPayloadForPlatform(platform, { ...basePayload, targetFormat });
        blockedTargets.push({
          queueId: q.id,
          targetId: row.id,
          status: "blocked_capability_mismatch",
          detail: compat.reason ?? "format",
        });
        routedTargets.push({
          targetId: row.id,
          queueId: q.id,
          targetPlatform: platform,
          targetFormat,
          selectedProfileId: profile.profileId,
          routingStatus: "blocked_capability_mismatch",
          payloadJson,
          routingWarnings: [
            ...warnings,
            `Format "${targetFormat}" is a weak match for ${platform} — revise format or export manually.`,
          ],
        });
        continue;
      }

      if (!profile.canPublish) {
        requiresManual++;
        manualFallback++;
        const { payloadJson, warnings } = transformPayloadForPlatform(platform, { ...basePayload, targetFormat });
        routedTargets.push({
          targetId: row.id,
          queueId: q.id,
          targetPlatform: platform,
          targetFormat,
          selectedProfileId: profile.profileId,
          routingStatus: "requires_manual_export",
          payloadJson,
          routingWarnings: [
            ...warnings,
            "Connector is linked but automated publish is not available for this platform (adapter or scopes).",
          ],
        });
        continue;
      }

      const { payloadJson, warnings } = transformPayloadForPlatform(platform, { ...basePayload, targetFormat });
      if (input.publishingObjective === "approval_review") {
        warnings.push("Publishing objective is approval_review — confirm copy before auto-publish.");
      }
      autoPublishReady++;
      routedTargets.push({
        targetId: row.id,
        queueId: q.id,
        targetPlatform: platform,
        targetFormat,
        selectedProfileId: profile.profileId,
        routingStatus: "ready",
        payloadJson,
        routingWarnings: warnings,
      });
    }
  }

  const connectorCoverageSummary: ConnectorCoverageSummary = {
    connectedPlatforms: input.capabilityMatrix.connectedPlatforms,
    autoPublishReadyCount: autoPublishReady,
    manualFallbackCount: manualFallback,
    blockedTargetsCount: blockedTargets.length,
    blockedNoConnectorCount: blockedNoConnector,
    blockedCapabilityMismatchCount: blockedCapability,
    requiresManualExportCount: requiresManual,
    recommendedConnectorAction: recommendedAction(input.capabilityMatrix, blockedNoConnector),
    matrixSummaryLine,
  };

  return {
    routedTargets,
    autoPublishReady,
    manualFallback,
    blockedTargets,
    connectorCoverageSummary,
  };
}
