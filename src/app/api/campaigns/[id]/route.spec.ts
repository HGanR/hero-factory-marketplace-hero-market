/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { campaignPosts, campaignReviewerAssignments } from "@/lib/db/schema";
import type { CampaignRow } from "@/lib/db/schema";

let adminCookieValue: string | undefined;

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn((name: string) =>
      name === "admin-token" && adminCookieValue ? { value: adminCookieValue } : undefined
    ),
  })),
}));

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/db");
jest.mock("@/lib/revenue-os/get-campaign-reviewer-access");

const campaignRow = {
  id: "camp-1",
  userId: "9",
  name: "C",
  objective: null,
  status: "active",
  startAt: null,
  endAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  clientId: "cl-1",
  publishApprovalChainJson: null,
  publishApprovalReportScheduleJson: null,
} as unknown as CampaignRow;

function buildDbForGet() {
  const orderBy = jest.fn(async () => []);
  const wherePosts = jest.fn(() => ({ orderBy }));
  const whereAssign = jest.fn(async () => []);
  const select = jest.fn(() => ({
    from: (tbl: unknown) => {
      if (tbl === campaignPosts) return { where: wherePosts };
      if (tbl === campaignReviewerAssignments) return { where: whereAssign };
      throw new Error("unexpected table");
    },
  }));
  return { select };
}

describe("/api/campaigns/[id]", () => {
  beforeEach(() => {
    adminCookieValue = undefined;
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(getCampaignReviewerAccess).mockReset();
  });

  describe("GET", () => {
    it("returns 401 UNAUTHORIZED when not signed in", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(null);
      const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1"), {
        params: Promise.resolve({ id: "camp-1" }),
      });
      expect(res.status).toBe(401);
      const j = (await res.json()) as { error: string };
      expect(j.error).toBe("UNAUTHORIZED");
    });

    it("returns 404 NOT_FOUND when no access", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
      (getDb as jest.Mock).mockResolvedValue({});
      const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1"), {
        params: Promise.resolve({ id: "camp-1" }),
      });
      expect(res.status).toBe(404);
      const j = (await res.json()) as { error: string };
      expect(j.error).toBe("NOT_FOUND");
    });

    it("returns governance entitlements and tier on success", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
        campaign: campaignRow,
        reviewerRole: "owner",
      });
      (getDb as jest.Mock).mockResolvedValue(buildDbForGet());
      const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1"), {
        params: Promise.resolve({ id: "camp-1" }),
      });
      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        governanceEntitlements: Record<string, boolean>;
        governancePlanTierLabel: string;
        reviewerRoleCounts: { approver: number };
      };
      expect(j.governancePlanTierLabel).toBeTruthy();
      expect(typeof j.governanceEntitlements.reviewerAssignmentsEnabled).toBe("boolean");
      expect(j.governanceEntitlements.approvalAnalyticsEnabled).toBe(true);
      expect(j.reviewerRoleCounts).toEqual({ approver: 0, editor: 0, reviewer: 0 });
    });

    it("returns campaign_posts from DB in posts for planner consumption", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
        campaign: campaignRow,
        reviewerRole: "owner",
      });
      const scheduledAt = new Date("2026-04-15T12:00:00.000Z");
      const bentleyPost = {
        id: "post-bentley-1",
        campaignId: "camp-1",
        platform: "instagram",
        assetId: null,
        scheduledAt,
        status: "SCHEDULED",
        caption: "Bentley hook\n\nOffer line",
        hashtags: null,
        linkUrl: null,
        utmParams: { bentley_unit_key: "abc", bentley_approval_status: "not_required" },
        scheduledPublishMeta: { scheduledPublishSource: "bentley_sync_launch" },
        platformPostId: null,
        errorMessage: null,
        postedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const orderBy = jest.fn(async () => [bentleyPost]);
      const wherePosts = jest.fn(() => ({ orderBy }));
      const whereAssign = jest.fn(async () => []);
      const select = jest.fn(() => ({
        from: (tbl: unknown) => {
          if (tbl === campaignPosts) return { where: wherePosts };
          if (tbl === campaignReviewerAssignments) return { where: whereAssign };
          throw new Error("unexpected table");
        },
      }));
      (getDb as jest.Mock).mockResolvedValue({ select });

      const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1"), {
        params: Promise.resolve({ id: "camp-1" }),
      });
      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        posts: Array<{ id: string; platform: string; caption: string | null; utmParams: unknown }>;
      };
      expect(j.posts).toHaveLength(1);
      expect(j.posts[0]!.id).toBe("post-bentley-1");
      expect(j.posts[0]!.platform).toBe("instagram");
      expect(j.posts[0]!.caption).toContain("Bentley");
      expect((j.posts[0]!.utmParams as Record<string, string>).bentley_unit_key).toBe("abc");
    });
  });

  describe("PATCH", () => {
    it("returns VALIDATION_ERROR on zod failure", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
        campaign: campaignRow,
        reviewerRole: "owner",
      });
      (getDb as jest.Mock).mockResolvedValue({});
      const req = new NextRequest("http://localhost/api/campaigns/camp-1", {
        method: "PATCH",
        body: JSON.stringify({ publishApprovalChain: { steps: "nope" } }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "camp-1" }) });
      expect(res.status).toBe(400);
      const j = (await res.json()) as { error: string; details?: unknown };
      expect(j.error).toBe("VALIDATION_ERROR");
    });

    it("returns NO_CHANGES when body empty of governance fields", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
        campaign: campaignRow,
        reviewerRole: "owner",
      });
      (getDb as jest.Mock).mockResolvedValue({});
      const req = new NextRequest("http://localhost/api/campaigns/camp-1", {
        method: "PATCH",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "camp-1" }) });
      expect(res.status).toBe(400);
      const j = (await res.json()) as { error: string };
      expect(j.error).toBe("NO_CHANGES");
    });

    it("returns FORBIDDEN_CAMPAIGN_SETTINGS for non-owner without admin", async () => {
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
        campaign: campaignRow,
        reviewerRole: "approver",
      });
      (getDb as jest.Mock).mockResolvedValue({});
      const req = new NextRequest("http://localhost/api/campaigns/camp-1", {
        method: "PATCH",
        body: JSON.stringify({ publishApprovalChain: null }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "camp-1" }) });
      expect(res.status).toBe(403);
      const j = (await res.json()) as { error: string };
      expect(j.error).toBe("FORBIDDEN_CAMPAIGN_SETTINGS");
    });
  });
});
