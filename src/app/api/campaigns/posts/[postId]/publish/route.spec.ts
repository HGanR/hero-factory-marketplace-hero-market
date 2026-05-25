/**
 * @jest-environment node
 *
 * Route-level contract for manual publish — aligns with `loadCampaignPostPublishContext` /
 * `executeCampaignPostAdapterPublish` outcomes.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  loadCampaignPostPublishContext,
  executeCampaignPostAdapterPublish,
  CampaignPostPublishError,
} from "@/lib/social/campaign-post-publish";
import { campaignPosts, campaigns } from "@/lib/db/schema";

jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));
jest.mock("@/lib/social/campaign-post-publish", () => ({
  ...jest.requireActual<typeof import("@/lib/social/campaign-post-publish")>(
    "@/lib/social/campaign-post-publish"
  ),
  loadCampaignPostPublishContext: jest.fn(),
  executeCampaignPostAdapterPublish: jest.fn(),
}));
jest.mock("@/lib/revenue-os/deployment-feedback-db", () => ({
  persistPublishOutcomeDeploymentFeedback: jest.fn().mockResolvedValue(undefined),
}));

const mockLoad = jest.mocked(loadCampaignPostPublishContext);
const mockExecute = jest.mocked(executeCampaignPostAdapterPublish);

const postRow = {
  id: "post-1",
  campaignId: "camp-1",
  platform: "linkedin",
  status: "DRAFT",
  socialAccountId: "acc-1",
  caption: "Hi",
  assetId: null,
  linkUrl: null,
  utmParams: null,
};

const campaignRow = {
  id: "camp-1",
  userId: "9",
  clientId: "cl-1",
};

function buildDb() {
  return {
    select: jest.fn(() => ({
      from: jest.fn((tbl: unknown) => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => {
            if (tbl === campaignPosts) return [postRow];
            if (tbl === campaigns) return [campaignRow];
            return [];
          }),
        })),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(undefined),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn().mockResolvedValue(undefined),
    })),
  };
}

describe("POST /api/campaigns/posts/[postId]/publish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAuthedUserId).mockResolvedValue("9");
    (getDb as jest.Mock).mockResolvedValue(buildDb());
  });

  it("returns 200 with platformPostId when adapter publish succeeds (matches execution result)", async () => {
    mockLoad.mockResolvedValue({
      platformKey: "linkedin",
      post: postRow as never,
      campaign: campaignRow as never,
      accountRow: {} as never,
      accessToken: "t",
      refreshToken: null,
    });
    mockExecute.mockResolvedValue({ platformPostId: "urn:li:share:123" });

    const req = new NextRequest("http://localhost/api/campaigns/posts/post-1/publish", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ postId: "post-1" }) });

    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; platformPostId: string; status: string };
    expect(j.ok).toBe(true);
    expect(j.platformPostId).toBe("urn:li:share:123");
    expect(j.status).toBe("POSTED");
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 502 with ACCOUNT_NOT_CONNECTED when load fails before publish (same code as lower layer)", async () => {
    mockLoad.mockRejectedValue(
      new CampaignPostPublishError("ACCOUNT_NOT_CONNECTED", "Connect your linkedin account first.")
    );

    const req = new NextRequest("http://localhost/api/campaigns/posts/post-1/publish", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ postId: "post-1" }) });

    expect(res.status).toBe(502);
    const j = (await res.json()) as { error: string; code: string; message: string };
    expect(j.error).toBe("PUBLISH_FAILED");
    expect(j.code).toBe("ACCOUNT_NOT_CONNECTED");
    expect(j.message).toContain("Connect");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 502 with PLATFORM_UNSUPPORTED when adapter is not implemented (honest manual path)", async () => {
    mockLoad.mockRejectedValue(
      new CampaignPostPublishError("PLATFORM_UNSUPPORTED", "tiktok publishing not implemented")
    );

    const req = new NextRequest("http://localhost/api/campaigns/posts/post-1/publish", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ postId: "post-1" }) });

    expect(res.status).toBe(502);
    const j = (await res.json()) as { code: string };
    expect(j.code).toBe("PLATFORM_UNSUPPORTED");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
