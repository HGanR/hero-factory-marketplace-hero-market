import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { campaigns, campaignPosts, campaignAssets } from "@/lib/db/schema";
import { processContent360DuePost } from "@/lib/social/content360-publish-worker";

describe("processContent360DuePost platform-key scheduled branch", () => {
  const prevBase = process.env.CONTENT360_BASE_URL;
  const prevKey = process.env.CONTENT360_API_KEY;
  const prevEnabled = process.env.CONTENT360_ENABLED;

  beforeEach(() => {
    process.env.CONTENT360_BASE_URL = "https://api.content360.test";
    process.env.CONTENT360_API_KEY = "test-platform-key";
    process.env.CONTENT360_ENABLED = "true";
  });

  afterEach(() => {
    if (prevBase === undefined) delete process.env.CONTENT360_BASE_URL;
    else process.env.CONTENT360_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.CONTENT360_API_KEY;
    else process.env.CONTENT360_API_KEY = prevKey;
    if (prevEnabled === undefined) delete process.env.CONTENT360_ENABLED;
    else process.env.CONTENT360_ENABLED = prevEnabled;
  });

  it("publishes via publishContent360Post when trusted platform schedule meta (no job id)", async () => {
    const store = {
      id: "p-plat",
      campaignId: "c1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
      scheduledPublishMeta: {
        publishRoute: "content360",
        content360PlatformScheduled: true,
        scheduledPublishSource: "bentley_sync_launch",
        targetPlatform: "instagram",
      },
      platform: "instagram",
      caption: "Hello world",
      assetId: "a1",
      utmParams: { u: "1" },
      linkUrl: "https://example.com",
    };
    let publishInput: unknown = null;
    const db = {
      select() {
        return {
          from(tbl: unknown) {
            return {
              where() {
                return {
                  limit: async () => {
                    if (tbl === campaigns) return [{ id: "c1", userId: "42", clientId: "cl1" }];
                    if (tbl === campaignPosts) return [store];
                    if (tbl === campaignAssets) return [{ storageUrl: "https://cdn.example/p.jpg" }];
                    return [];
                  },
                };
              },
            };
          },
        };
      },
      update() {
        return {
          set(vals: Record<string, unknown>) {
            return {
              where: async () => {
                Object.assign(store, vals);
                return [{ affectedRows: 1 }];
              },
            };
          },
        };
      },
      insert() {
        return { values: async () => {} };
      },
    };

    const r = await processContent360DuePost({
      db,
      post: store as never,
      campaignAutopilotPublish: true,
      now: new Date("2026-06-01T12:00:00.000Z"),
      requireApproval: false,
      publishContent360PostFn: async (input) => {
        publishInput = input;
        return { ok: true, platformPostId: "vendor-post-1", providerMetadata: { x: 1 } };
      },
    });

    assert.equal(r, "published");
    assert.equal(String(store.status), "POSTED");
    assert.ok(publishInput && typeof publishInput === "object");
    const pi = publishInput as Record<string, unknown>;
    assert.equal(pi.caption, "Hello world");
    assert.equal(pi.mediaUrl, "https://cdn.example/p.jpg");
    assert.deepEqual(pi.platforms, ["instagram"]);
    assert.equal(typeof pi.scheduledAt, "string");
    assert.equal(pi.campaignId, "c1");
    assert.equal(pi.postId, "p-plat");
  });

  it("fails with missing job when content360PlatformScheduled is untrusted (manual_schedule)", async () => {
    const store = {
      id: "p-bad",
      campaignId: "c1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-06-01T11:00:00.000Z"),
      scheduledPublishMeta: {
        publishRoute: "content360",
        content360PlatformScheduled: true,
        scheduledPublishSource: "manual_schedule",
      },
      platform: "instagram",
      caption: "x",
      assetId: null,
      utmParams: null,
      linkUrl: null,
    };
    const db = {
      select() {
        return {
          from(tbl: unknown) {
            return {
              where() {
                return {
                  limit: async () => {
                    if (tbl === campaigns) return [{ id: "c1", userId: "42", clientId: "cl1" }];
                    if (tbl === campaignPosts) return [store];
                    return [];
                  },
                };
              },
            };
          },
        };
      },
      update() {
        return {
          set(vals: Record<string, unknown>) {
            return {
              where: async () => {
                Object.assign(store, vals);
                return [{ affectedRows: 1 }];
              },
            };
          },
        };
      },
      insert() {
        return { values: async () => {} };
      },
    };

    const r = await processContent360DuePost({
      db,
      post: store as never,
      campaignAutopilotPublish: true,
      now: new Date("2026-06-01T12:00:00.000Z"),
      requireApproval: false,
    });

    assert.equal(r, "failed");
    assert.equal(String(store.status), "FAILED");
    assert.ok(String(store.errorMessage || "").includes("providerPublishJobId"));
  });
});
