import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { CampaignPostPublishContext } from "@/lib/social/campaign-post-publish";
import { defaultExecuteScheduledPublish } from "@/lib/social/run-due-scheduled-publishes";

jest.mock("@/lib/social/publish-linkedin-scheduled-post", () => ({
  publishLinkedinScheduledPost: jest.fn(),
}));

jest.mock("@/lib/social/campaign-post-publish", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/campaign-post-publish")>(
    "@/lib/social/campaign-post-publish"
  );
  return {
    ...actual,
    executeCampaignPostAdapterPublish: jest.fn(),
  };
});

import { publishLinkedinScheduledPost } from "@/lib/social/publish-linkedin-scheduled-post";
import { executeCampaignPostAdapterPublish } from "@/lib/social/campaign-post-publish";

function minimalCtx(platformKey: "linkedin" | "facebook" | "instagram"): CampaignPostPublishContext {
  return {
    post: { id: "p1" } as CampaignPostPublishContext["post"],
    campaign: {} as CampaignPostPublishContext["campaign"],
    platformKey,
    accountRow: {} as CampaignPostPublishContext["accountRow"],
    accessToken: "t",
    refreshToken: null,
  };
}

describe("defaultExecuteScheduledPublish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses LinkedIn scheduled path for linkedin", async () => {
    (publishLinkedinScheduledPost as jest.Mock).mockResolvedValue({ ok: true, externalPostId: "urn:li:1" });

    const r = await defaultExecuteScheduledPublish(minimalCtx("linkedin"));

    expect(publishLinkedinScheduledPost).toHaveBeenCalledTimes(1);
    expect(executeCampaignPostAdapterPublish).not.toHaveBeenCalled();
    expect(r.platformPostId).toBe("urn:li:1");
  });

  it("uses adapter publish for facebook", async () => {
    (executeCampaignPostAdapterPublish as jest.Mock).mockResolvedValue({ platformPostId: "fb-1" });

    const r = await defaultExecuteScheduledPublish(minimalCtx("facebook"));

    expect(executeCampaignPostAdapterPublish).toHaveBeenCalledTimes(1);
    expect(publishLinkedinScheduledPost).not.toHaveBeenCalled();
    expect(r.platformPostId).toBe("fb-1");
  });

  it("uses adapter publish for instagram", async () => {
    (executeCampaignPostAdapterPublish as jest.Mock).mockResolvedValue({ platformPostId: "ig-1" });

    const r = await defaultExecuteScheduledPublish(minimalCtx("instagram"));

    expect(executeCampaignPostAdapterPublish).toHaveBeenCalledTimes(1);
    expect(publishLinkedinScheduledPost).not.toHaveBeenCalled();
    expect(r.platformPostId).toBe("ig-1");
  });
});
