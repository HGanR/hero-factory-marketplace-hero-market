/**
 * Server: idempotent campaign_posts + schedule / approval routing for Bentley DB campaigns.
 */

import crypto from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { BentleyGenerationPayload } from "@/lib/revenue-os/ensure-campaign-from-bentley";
import { parseCampaignResponse } from "@/lib/revenue-os/campaign-schema";
import { readBentleyAutoPostImagesEnv } from "@/lib/revenue-os/bentley-auto-post-image-env";
import {
  buildBentleyPostImagePrompt,
  generateBentleyPostImage,
} from "@/lib/revenue-os/bentley-post-image";
import { maybeUpgradeBentleyCampaignAssetToDurableStorage } from "@/lib/revenue-os/bentley-campaign-asset-durable";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { BENTLEY_UTM_APPROVAL_STATUS } from "@/lib/revenue-os/publish-approval-utm";
import {
  buildBentleyDraftForPlatform,
  buildBentleyUnitKey,
  buildCaptionForPlatform,
  collectBentleyUnitKeysFromPosts,
  computeScheduledAt,
  resolveOauthPlatformsForBentleyLaunch,
  BENTLEY_UTM_UNIT_KEY,
  BENTLEY_UTM_OPTIMIZATION_RUN_ID,
  type ScheduleStrategy,
} from "@/lib/revenue-os/bentley-sync-launch-plan";
import { mergeRawScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";

export type SyncBentleyLaunchPostCreationMode = "scheduled" | "draft_unscheduled";

export type SyncBentleyLaunchInput = {
  userId: string;
  campaignId: string;
  scheduleStrategy: ScheduleStrategy;
  /** Minutes between slots when strategy is staggered. */
  staggerMinutes?: number;
  /** Override env-based approval gate (e.g. tests). */
  requireApprovalOverride?: boolean;
  /**
   * `draft_unscheduled` creates DRAFT posts without `scheduledAt` (assisted optimization execution).
   * Default matches launch sync: SCHEDULED with computed times.
   */
  postCreationMode?: SyncBentleyLaunchPostCreationMode;
  /** Stored in UTM for lineage; does not change `bentley_unit_key` (already unique per campaign id). */
  optimizationRunId?: string | null;
  /**
   * When true (only set from admin-gated sync-launch), scheduled posts use centralized
   * `CONTENT360_API_KEY` at worker time (`content360PlatformScheduled` + trusted source meta).
   */
  content360PlatformSchedule?: boolean;
};

export type SyncBentleyLaunchResult = {
  created: number;
  skipped: number;
  rescheduled: number;
  postIds: string[];
  requireApproval: boolean;
};

function parseGeneration(raw: unknown): BentleyGenerationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.campaign || typeof o.campaign !== "object") return null;
  return raw as BentleyGenerationPayload;
}

function bentleySyncLaunchScheduledPublishMeta(
  input: SyncBentleyLaunchInput,
  slotPlatform: string,
  isDraftVariant: boolean
): Record<string, unknown> {
  if (isDraftVariant) {
    return { scheduledPublishSource: "bentley_optimization_variant" as const };
  }
  if (input.content360PlatformSchedule) {
    return {
      scheduledPublishSource: "bentley_sync_launch" as const,
      publishRoute: "content360" as const,
      content360PlatformScheduled: true,
      targetPlatform: slotPlatform,
    };
  }
  return { scheduledPublishSource: "bentley_sync_launch" as const };
}

export async function syncBentleyCampaignPostsAndSchedule(
  db: MySql2Database<typeof schema>,
  input: SyncBentleyLaunchInput
): Promise<SyncBentleyLaunchResult> {
  const campaignRows = await db
    .select()
    .from(schema.campaigns)
    .where(
      and(eq(schema.campaigns.id, input.campaignId), eq(schema.campaigns.userId, String(input.userId)))
    )
    .limit(1);

  const camp = campaignRows[0];
  if (!camp) {
    throw new Error("Campaign not found");
  }

  const gen = parseGeneration(camp.bentleyGenerationJson);
  if (!gen) {
    throw new Error("Campaign has no Bentley generation payload — run campaign persistence first");
  }

  const campaign = parseCampaignResponse(gen.campaign as unknown);

  const requireApproval =
    input.requireApprovalOverride !== undefined
      ? input.requireApprovalOverride
      : readScheduledPublishRequireApprovalEnv();

  const platforms = resolveOauthPlatformsForBentleyLaunch({
    postingPlatforms: gen.postingPlatforms,
    contentPlatforms: gen.platforms,
  });

  const existingRows = await db
    .select()
    .from(schema.campaignPosts)
    .where(eq(schema.campaignPosts.campaignId, input.campaignId));

  const existingKeys = collectBentleyUnitKeysFromPosts(existingRows);
  const postIds: string[] = [];
  let created = 0;
  let skipped = 0;
  let rescheduled = 0;
  const nowMs = Date.now();
  const staggerMinutes = input.staggerMinutes ?? 30;
  const strategy = input.scheduleStrategy;
  const creationMode: SyncBentleyLaunchPostCreationMode = input.postCreationMode ?? "scheduled";

  const slots = platforms.map((platform, slotIndex) => ({
    platform,
    slotIndex,
    unitKey: buildBentleyUnitKey(input.campaignId, platform, 0),
    caption: buildCaptionForPlatform(platform, campaign),
    bentleyDraftJson: buildBentleyDraftForPlatform(platform, campaign),
  }));

  // Dedupe: same platform should not duplicate unit keys — slot 0 only per platform
  const seen = new Set<string>();
  const work = slots.filter((s) => {
    if (seen.has(s.unitKey)) return false;
    seen.add(s.unitKey);
    return true;
  });

  for (let i = 0; i < work.length; i++) {
    const slot = work[i]!;
    const scheduledAt =
      creationMode === "draft_unscheduled"
        ? null
        : computeScheduledAt({
            strategy,
            slotIndex: i,
            totalSlots: work.length,
            staggerMinutes,
            nowMs,
          });

    const utm: Record<string, string> = {
      [BENTLEY_UTM_UNIT_KEY]: slot.unitKey,
      bentley_source: "campaign_from_notes",
    };
    utm[BENTLEY_UTM_APPROVAL_STATUS] = requireApproval ? "pending_approval" : "not_required";
    const optRun = input.optimizationRunId?.trim();
    if (optRun) {
      utm[BENTLEY_UTM_OPTIMIZATION_RUN_ID] = optRun;
    }

    if (existingKeys.has(slot.unitKey)) {
      skipped += 1;
      const row = existingRows.find((r) => {
        const u = r.utmParams as Record<string, string> | null;
        return u?.[BENTLEY_UTM_UNIT_KEY] === slot.unitKey;
      });
      if (row) {
        postIds.push(row.id);
        const needsSchedule =
          creationMode === "scheduled" && row.status === "DRAFT" && row.scheduledAt == null;
        if (needsSchedule && scheduledAt) {
          const nextMeta = mergeRawScheduledPublishMeta(row.scheduledPublishMeta, {
            scheduledPublishSource: "bentley_sync_launch",
            ...(input.content360PlatformSchedule
              ? {
                  publishRoute: "content360",
                  content360PlatformScheduled: true,
                  targetPlatform: String(row.platform ?? slot.platform),
                }
              : {}),
          });
          await db
            .update(schema.campaignPosts)
            .set({
              scheduledAt,
              status: "SCHEDULED",
              utmParams: { ...((row.utmParams as Record<string, string>) ?? {}), ...utm },
              scheduledPublishMeta: nextMeta,
              updatedAt: new Date(),
            })
            .where(eq(schema.campaignPosts.id, row.id));
          rescheduled += 1;
        }
      }
      continue;
    }

    const postId = crypto.randomUUID();
    const isDraftVariant = creationMode === "draft_unscheduled";

    let assetId: string | null = null;
    if (readBentleyAutoPostImagesEnv()) {
      try {
        const imagePrompt = buildBentleyPostImagePrompt(
          slot.caption,
          gen.tone?.trim() || "Professional",
          gen.imageStyle?.trim() || "cinematic"
        );
        const img = await generateBentleyPostImage(imagePrompt, {
          platform: slot.platform,
          unitKey: slot.unitKey,
          campaignId: input.campaignId,
        });
        if (img?.storageUrl) {
          const aid = crypto.randomUUID();
          const assetMeta = {
            source: "bentley_auto",
            provider: img.provider,
            platform: slot.platform,
            bentley_unit_key: slot.unitKey,
          };
          await db.insert(schema.campaignAssets).values({
            id: aid,
            campaignId: input.campaignId,
            creativeType: "IMAGE",
            storageUrl: img.storageUrl,
            metadata: assetMeta,
          });
          assetId = aid;
        }
      } catch (e) {
        console.warn("[bentley-sync-launch] auto post image skipped:", e instanceof Error ? e.message : e);
      }
    }

    await db.insert(schema.campaignPosts).values({
      id: postId,
      campaignId: input.campaignId,
      ...(assetId ? { assetId } : {}),
      platform: slot.platform,
      scheduledAt,
      status: isDraftVariant ? "DRAFT" : "SCHEDULED",
      caption: slot.caption,
      bentleyDraftJson: slot.bentleyDraftJson,
      utmParams: utm,
      scheduledPublishMeta: bentleySyncLaunchScheduledPublishMeta(input, slot.platform, isDraftVariant),
    });
    postIds.push(postId);
    created += 1;
    existingKeys.add(slot.unitKey);

    if (assetId && readBentleyAutoPostImagesEnv()) {
      const imgRow = (
        await db
          .select()
          .from(schema.campaignAssets)
          .where(
            and(
              eq(schema.campaignAssets.id, assetId),
              eq(schema.campaignAssets.campaignId, input.campaignId)
            )
          )
          .limit(1)
      )[0];
      if (imgRow) {
        void maybeUpgradeBentleyCampaignAssetToDurableStorage(db, imgRow)
          .then((r) => {
            if (r.status === "failed") {
              console.warn("[bentley-sync-launch] durable image upgrade failed:", r.reason);
            }
          })
          .catch((e) =>
            console.warn(
              "[bentley-sync-launch] durable image upgrade error:",
              e instanceof Error ? e.message : e
            )
          );
      }
    }
  }

  if (work.length > 0 && postIds.length === 0) {
    throw new Error(
      "Bentley launch sync produced no campaign_posts attachments — check bentley_unit_key / DB drift."
    );
  }

  return {
    created,
    skipped,
    rescheduled,
    postIds,
    requireApproval,
  };
}
