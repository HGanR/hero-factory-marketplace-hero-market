/**
 * Publish execution contract: adapter payload shape, unsupported platform, missing account.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  campaignPosts,
  campaigns,
  socialAccounts,
} from "@/lib/db/schema";
import {
  executeCampaignPostAdapterPublish,
  loadCampaignPostPublishContext,
} from "@/lib/social/campaign-post-publish";
import * as adapters from "@/lib/social/adapters";
import type { SocialAdapter } from "@/lib/social/types";
import type { PublishResult } from "@/lib/social/types";

const getAdapterSpy = jest.spyOn(adapters, "getAdapter");

describe("executeCampaignPostAdapterPublish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes caption, linkUrl, hashtags, and asset fields into the selected adapter publish()", async () => {
    const publish = jest.fn().mockResolvedValue({ platformPostId: "urn:li:1" } satisfies PublishResult);
    const adapter = { publish } as unknown as SocialAdapter;
    getAdapterSpy.mockReturnValue(adapter);

    await executeCampaignPostAdapterPublish({
      post: {
        caption: "Hello #world",
        hashtags: "one two",
        linkUrl: "https://example.com",
        utmParams: null,
      } as never,
      campaign: { userId: "u1" } as never,
      platformKey: "linkedin",
      accountRow: { id: "acc1", displayName: "Me" } as never,
      accessToken: "tok",
      refreshToken: null,
      assetUrl: "https://cdn/asset.jpg",
      assetCreativeType: "IMAGE",
      finalLink: "https://example.com?utm_source=x",
    });

    expect(publish).toHaveBeenCalledTimes(1);
    const [accountArg, bodyArg] = publish.mock.calls[0]!;
    expect(accountArg).toMatchObject({ accessToken: "tok", id: "acc1" });
    expect(bodyArg).toEqual({
      caption: "Hello #world",
      assetUrl: "https://cdn/asset.jpg",
      assetCreativeType: "IMAGE",
      linkUrl: "https://example.com?utm_source=x",
      hashtags: ["one", "two"],
    });
  });

  it("throws PLATFORM_UNSUPPORTED when no adapter is registered (honest manual path)", async () => {
    getAdapterSpy.mockReturnValue(null);

    await expect(
      executeCampaignPostAdapterPublish({
        post: { caption: "x" } as never,
        campaign: {} as never,
        platformKey: "tiktok",
        accountRow: {} as never,
        accessToken: "t",
        refreshToken: null,
      })
    ).rejects.toMatchObject({
      code: "PLATFORM_UNSUPPORTED",
      message: expect.stringContaining("tiktok"),
    });
  });
});

describe("loadCampaignPostPublishContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAdapterSpy.mockImplementation(adapters.getAdapter);
  });

  it("throws ACCOUNT_NOT_CONNECTED before any publish when no linked social account exists", async () => {
    const post = {
      id: "post-1",
      campaignId: "camp-1",
      platform: "linkedin",
      socialAccountId: null,
      caption: "c",
      assetId: null,
      linkUrl: null,
      utmParams: null,
    };
    const campaign = {
      id: "camp-1",
      userId: "u1",
      clientId: "client-1",
    };

    const db = {
      select: jest.fn(() => ({
        from: jest.fn((table: unknown) => {
          if (table === campaignPosts) {
            return {
              where: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue([post]),
              })),
            };
          }
          if (table === campaigns) {
            return {
              where: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue([campaign]),
              })),
            };
          }
          if (table === socialAccounts) {
            return {
              where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue([]),
                })),
              })),
            };
          }
          throw new Error(`unexpected table ${String(table)}`);
        }),
      })),
    };

    await expect(loadCampaignPostPublishContext(db as never, "post-1")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_CONNECTED",
    });
    expect(getAdapterSpy).not.toHaveBeenCalled();
  });
});
