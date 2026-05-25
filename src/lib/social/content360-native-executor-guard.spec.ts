import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultExecuteScheduledPublish } from "@/lib/social/run-due-scheduled-publishes";
import {
  CampaignPostPublishError,
  executeCampaignPostAdapterPublish,
} from "@/lib/social/campaign-post-publish";
import type { CampaignPostPublishContext } from "@/lib/social/campaign-post-publish";

function minimalCtx(
  platformKey: "linkedin" | "facebook" | "instagram",
  meta?: Record<string, unknown>,
): CampaignPostPublishContext {
  return {
    post: {
      id: "p1",
      scheduledPublishMeta: meta,
    } as CampaignPostPublishContext["post"],
    campaign: {} as CampaignPostPublishContext["campaign"],
    platformKey,
    accountRow: {} as CampaignPostPublishContext["accountRow"],
    accessToken: "t",
    refreshToken: null,
  };
}

describe("defaultExecuteScheduledPublish Content360 guard", () => {
  it("throws CONTENT360_WRONG_EXECUTOR when publishRoute is content360 (non-LinkedIn path)", async () => {
    await assert.rejects(
      () => defaultExecuteScheduledPublish(minimalCtx("facebook", { publishRoute: "content360" })),
      (err: unknown) => err instanceof CampaignPostPublishError && err.code === "CONTENT360_WRONG_EXECUTOR",
    );
  });
});

describe("executeCampaignPostAdapterPublish Content360 guard", () => {
  it("throws before loading any adapter when publishRoute is content360", async () => {
    await assert.rejects(
      () =>
        executeCampaignPostAdapterPublish({
          post: { scheduledPublishMeta: { publishRoute: "content360" } } as CampaignPostPublishContext["post"],
          campaign: {} as CampaignPostPublishContext["campaign"],
          platformKey: "facebook",
          accountRow: {} as CampaignPostPublishContext["accountRow"],
          accessToken: "t",
          refreshToken: null,
        }),
      (err: unknown) => err instanceof CampaignPostPublishError && err.code === "CONTENT360_WRONG_EXECUTOR",
    );
  });
});
