/**
 * @jest-environment node
 *
 * DB-shaped integration tests for Bentley sync-launch (in-memory Drizzle mock).
 */
jest.mock("@/lib/revenue-os/bentley-campaign-asset-durable", () => ({
  maybeUpgradeBentleyCampaignAssetToDurableStorage: jest
    .fn()
    .mockResolvedValue({ status: "skipped", reason: "test_mock" }),
}));

import { describe, it, expect, jest, afterEach } from "@jest/globals";
import * as AutoImg from "@/lib/revenue-os/bentley-auto-post-image-env";
import * as PostImg from "@/lib/revenue-os/bentley-post-image";
import { syncBentleyCampaignPostsAndSchedule } from "@/lib/revenue-os/bentley-sync-launch-server";
import { createBentleySyncLaunchMemoryDb } from "@/lib/revenue-os/bentley-sync-launch-memory-db";
import {
  buildBentleyUnitKey,
  BENTLEY_UTM_UNIT_KEY,
} from "@/lib/revenue-os/bentley-sync-launch-plan";
import { BENTLEY_UTM_APPROVAL_STATUS } from "@/lib/revenue-os/publish-approval-utm";

const CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "42";

function minimalGeneration(postingPlatforms: string[], contentPlatforms: string[]) {
  return {
    campaign: {
      offerStatement: "Offer line",
      shortFormHooks: ["Hook A", "Hook B"],
      industry: "X",
      targetAudience: "Y",
      messagePillars: [],
      longFormOutlines: [],
      objectionReplies: [],
    },
    platforms: contentPlatforms,
    postingPlatforms,
    syncedAt: new Date().toISOString(),
  };
}

describe("syncBentleyCampaignPostsAndSchedule (memory DB)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates one post per resolved OAuth platform", async () => {
    const { db, getPosts } = createBentleySyncLaunchMemoryDb({
      campaign: {
        id: CAMPAIGN_ID,
        userId: USER_ID,
        bentleyGenerationJson: minimalGeneration(["instagram", "tiktok"], ["Instagram", "TikTok"]),
      },
    });

    const r = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
      requireApprovalOverride: false,
    });

    expect(r.created).toBe(2);
    expect(r.skipped).toBe(0);
    const posts = getPosts();
    expect(posts).toHaveLength(2);
    const platforms = posts.map((p) => p.platform).sort();
    expect(platforms).toEqual(["instagram", "tiktok"]);
    for (const p of posts) {
      expect(p.status).toMatch(/SCHEDULED|DRAFT/);
      expect(p.caption?.length).toBeGreaterThan(0);
      const u = p.utmParams as Record<string, string> | undefined;
      expect(u?.[BENTLEY_UTM_UNIT_KEY]?.length).toBeGreaterThan(0);
    }
  });

  it("does not duplicate posts when rerun with the same campaign", async () => {
    const { db, getPosts } = createBentleySyncLaunchMemoryDb({
      campaign: {
        id: CAMPAIGN_ID,
        userId: USER_ID,
        bentleyGenerationJson: minimalGeneration(["instagram", "linkedin"], ["Instagram", "LinkedIn"]),
      },
    });

    const first = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });
    expect(first.created).toBe(2);

    const second = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2);
    expect(getPosts()).toHaveLength(2);
  });

  it("schedules an existing DRAFT row without scheduledAt when unit key matches", async () => {
    const uk = buildBentleyUnitKey(CAMPAIGN_ID, "instagram", 0);
    const { db, getPosts } = createBentleySyncLaunchMemoryDb({
      campaign: {
        id: CAMPAIGN_ID,
        userId: USER_ID,
        bentleyGenerationJson: minimalGeneration(["instagram"], ["Instagram"]),
      },
      posts: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          campaignId: CAMPAIGN_ID,
          platform: "instagram",
          scheduledAt: null,
          status: "DRAFT",
          caption: "Old",
          utmParams: { [BENTLEY_UTM_UNIT_KEY]: uk },
        },
      ],
    });

    const r = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });

    expect(r.created).toBe(0);
    expect(r.skipped).toBe(1);
    expect(r.rescheduled).toBe(1);
    const p = getPosts()[0]!;
    expect(p.status).toBe("SCHEDULED");
    expect(p.scheduledAt).not.toBeNull();
  });

  it("writes pending_approval UTM when approval is required", async () => {
    const { db, getPosts } = createBentleySyncLaunchMemoryDb({
      campaign: {
        id: CAMPAIGN_ID,
        userId: USER_ID,
        bentleyGenerationJson: minimalGeneration(["instagram"], ["Instagram"]),
      },
    });

    await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "immediate",
      requireApprovalOverride: true,
    });

    const u = getPosts()[0]!.utmParams as Record<string, string>;
    expect(u[BENTLEY_UTM_APPROVAL_STATUS]).toBe("pending_approval");
  });

  it("writes not_required UTM when approval is disabled", async () => {
    const { db, getPosts } = createBentleySyncLaunchMemoryDb({
      campaign: {
        id: CAMPAIGN_ID,
        userId: USER_ID,
        bentleyGenerationJson: minimalGeneration(["instagram"], ["Instagram"]),
      },
    });

    await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });

    const u = getPosts()[0]!.utmParams as Record<string, string>;
    expect(u[BENTLEY_UTM_APPROVAL_STATUS]).toBe("not_required");
  });

  it("inserts campaign_assets and links assetId when auto-post-images is enabled", async () => {
    jest.spyOn(AutoImg, "readBentleyAutoPostImagesEnv").mockReturnValue(true);
    jest.spyOn(PostImg, "generateBentleyPostImage").mockResolvedValue({
      storageUrl: "https://example.com/auto.png",
      provider: "test_mock",
    });

    const gen = {
      ...minimalGeneration(["instagram"], ["Instagram"]),
      tone: "Bold",
      imageStyle: "minimal studio",
    };
    const { db, getPosts, getAssets } = createBentleySyncLaunchMemoryDb({
      campaign: {
        id: CAMPAIGN_ID,
        userId: USER_ID,
        bentleyGenerationJson: gen,
      },
    });

    await syncBentleyCampaignPostsAndSchedule(db, {
      userId: USER_ID,
      campaignId: CAMPAIGN_ID,
      scheduleStrategy: "immediate",
      requireApprovalOverride: false,
    });

    const posts = getPosts();
    const ast = getAssets();
    expect(ast).toHaveLength(1);
    expect(ast[0]!.storageUrl).toBe("https://example.com/auto.png");
    expect(posts[0]!.assetId).toBe(ast[0]!.id);
    expect(PostImg.generateBentleyPostImage).toHaveBeenCalledWith(
      expect.stringMatching(/Bold[\s\S]*minimal studio/),
      expect.objectContaining({ campaignId: CAMPAIGN_ID })
    );
  });
});
