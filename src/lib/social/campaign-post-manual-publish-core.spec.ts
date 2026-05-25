/**
 * Manual campaign post publish core — `npm test` (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campaignPosts, campaigns, campaignAssets } from "@/lib/db/schema";
import { runManualCampaignPostPublishCore } from "@/lib/social/campaign-post-manual-publish-core";
import { CampaignPostPublishError } from "@/lib/social/campaign-post-publish";

const postRow = {
  id: "post-1",
  campaignId: "camp-1",
  platform: "linkedin",
  status: "DRAFT",
  socialAccountId: "acc-1",
  caption: "Hi caption",
  assetId: "asset-1",
  linkUrl: null,
  utmParams: null,
  scheduledPublishMeta: null as unknown,
};

const campaignRow = {
  id: "camp-1",
  userId: "9",
  clientId: "cl-1",
};

function buildDb(overrides?: { post?: typeof postRow }) {
  const p = overrides?.post ?? postRow;
  return {
    select: () => ({
      from: (tbl: unknown) => ({
        where: () => ({
          limit: async () => {
            if (tbl === campaignPosts) return [p];
            if (tbl === campaigns) return [campaignRow];
            if (tbl === campaignAssets) return [{ storageUrl: "https://cdn.example/media.jpg" }];
            return [];
          },
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => [{ affectedRows: 1 }],
      }),
    }),
    insert: () => ({
      values: async () => {},
    }),
  };
}

describe("runManualCampaignPostPublishCore", () => {
  it("returns 403 CONTENT360_ADMIN_REQUIRED for content360 route without admin token verification", async () => {
    const c360Post = {
      ...postRow,
      scheduledPublishMeta: { publishRoute: "content360", targetPlatform: "instagram" },
    };
    const out = await runManualCampaignPostPublishCore({
      userId: 9,
      postId: "post-1",
      adminTokenCookie: undefined,
      db: buildDb({ post: c360Post }),
      deps: {
        verifyToken: () => null,
        jwtPayloadIndicatesPlatformAdmin: () => false,
      },
    });
    assert.equal(out.status, 403);
    assert.equal((out.body as { code?: string }).code, "CONTENT360_ADMIN_REQUIRED");
  });

  it("succeeds for content360 route with admin token and calls publishContent360Post with caption, media, platforms, scheduledAt null", async () => {
    const c360Post = {
      ...postRow,
      scheduledPublishMeta: { publishRoute: "content360", targetPlatform: "instagram" },
    };
    let captured: Record<string, unknown> | null = null;
    const out = await runManualCampaignPostPublishCore({
      userId: 9,
      postId: "post-1",
      adminTokenCookie: "adm",
      db: buildDb({ post: c360Post }),
      deps: {
        verifyToken: () => ({ isAdmin: true, userId: 9 }),
        jwtPayloadIndicatesPlatformAdmin: (pl: unknown) =>
          Boolean(pl && typeof pl === "object" && (pl as { isAdmin?: boolean }).isAdmin === true),
        publishContent360Post: async (input) => {
          captured = { ...input };
          return { ok: true, platformPostId: "ext-99", providerMetadata: { ok: true } };
        },
        persistPublishOutcomeDeploymentFeedback: async () => {},
        recordClientHubAutomationEvent: async () => {},
      },
    });
    assert.equal(out.status, 200);
    assert.equal((out.body as { platformPostId?: string }).platformPostId, "ext-99");
    assert.equal((out.body as { publishRoute?: string }).publishRoute, "content360");
    assert.ok(captured);
    assert.equal((captured as { caption?: string }).caption, "Hi caption");
    assert.equal((captured as { mediaUrl?: string }).mediaUrl, "https://cdn.example/media.jpg");
    assert.deepEqual((captured as { platforms?: string[] }).platforms, ["instagram"]);
    assert.equal((captured as { scheduledAt?: unknown }).scheduledAt, null);
    assert.equal((captured as { campaignId?: string }).campaignId, "camp-1");
    assert.equal((captured as { postId?: string }).postId, "post-1");
  });

  it("returns 200 for native path using adapter deps", async () => {
    const out = await runManualCampaignPostPublishCore({
      userId: 9,
      postId: "post-1",
      adminTokenCookie: undefined,
      db: buildDb(),
      deps: {
        verifyToken: () => null,
        jwtPayloadIndicatesPlatformAdmin: () => false,
        loadCampaignPostPublishContext: async () =>
          ({
            platformKey: "linkedin",
            post: postRow as never,
            campaign: campaignRow as never,
            accountRow: {} as never,
            accessToken: "t",
            refreshToken: null,
          }) as never,
        executeCampaignPostAdapterPublish: async () => ({ platformPostId: "urn:li:1" }),
        persistPublishOutcomeDeploymentFeedback: async () => {},
        recordClientHubAutomationEvent: async () => {},
      },
    });
    assert.equal(out.status, 200);
    assert.equal((out.body as { platformPostId?: string }).platformPostId, "urn:li:1");
  });

  it("returns 502 when native load throws ACCOUNT_NOT_CONNECTED", async () => {
    const out = await runManualCampaignPostPublishCore({
      userId: 9,
      postId: "post-1",
      adminTokenCookie: undefined,
      db: buildDb(),
      deps: {
        verifyToken: () => null,
        jwtPayloadIndicatesPlatformAdmin: () => false,
        loadCampaignPostPublishContext: async () => {
          throw new CampaignPostPublishError("ACCOUNT_NOT_CONNECTED", "Connect your linkedin account first.");
        },
        persistPublishOutcomeDeploymentFeedback: async () => {},
      },
    });
    assert.equal(out.status, 502);
    assert.equal((out.body as { code?: string }).code, "ACCOUNT_NOT_CONNECTED");
  });
});
