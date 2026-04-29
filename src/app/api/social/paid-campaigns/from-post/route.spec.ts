/**
 * @jest-environment node
 */
jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));
jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/revenue-os/get-campaign-reviewer-access");
jest.mock("@/lib/social/paid-social-campaigns", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-campaigns")>(
    "@/lib/social/paid-social-campaigns"
  );
  return {
    ...actual,
    createPaidSocialCampaignDraftFromOrganicPost: jest.fn(),
    listPaidSocialCampaignsByCampaign: jest.fn(),
    projectPaidSocialCampaignsPublicForList: jest.fn((...args: unknown[]) =>
      actual.projectPaidSocialCampaignsPublicForList(
        ...(args as Parameters<typeof actual.projectPaidSocialCampaignsPublicForList>)
      )
    ),
  };
});

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import * as PaidCampaignsModule from "@/lib/social/paid-social-campaigns";
import {
  computePromotionDecisionSummaryForCampaign,
  createPaidSocialCampaignDraftFromOrganicPost,
  listPaidSocialCampaignsByCampaign,
  PaidSocialCampaignError,
  projectPaidSocialCampaignPublic,
  type PaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";

const CAMP = "11111111-1111-4111-8111-111111111111";
const POST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let POST_HANDLER: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST: POST_HANDLER } = await import("./route"));
});

function mockRow(): import("@/lib/db/schema").CampaignPaidSocialCampaignRow {
  return {
    id: PAID,
    campaignId: CAMP,
    provider: "meta_ads",
    internalName: "Promoted: x",
    adSetName: null,
    adName: null,
    objective: "",
    draftStatus: "draft",
    budgetType: "none",
    budgetAmountMinor: null,
    currency: "USD",
    startAt: null,
    endAt: null,
    destinationUrl: null,
    ctaLabel: null,
    leadFormPlaceholder: null,
    audienceJson: null,
    placementsJson: null,
    creativeConfigJson: { referenceOrganicPostId: POST, notes: "n" },
    createdByUserId: "1",
    updatedByUserId: "1",
    createdAt: new Date(),
    updatedAt: new Date(),
    metaAdAccountId: null,
    metaPageId: null,
    metaFacebookSocialAccountId: null,
    metaLaunchStatus: "idle",
    remoteMetaCampaignId: null,
    remoteMetaAdsetId: null,
    remoteMetaCreativeId: null,
    remoteMetaAdId: null,
    lastLaunchErrorJson: null,
    launchedAt: null,
    lastMetaSyncAt: null,
    metaRuntimeStatus: null,
    lastMetaStatusJson: null,
    lastMetaSyncErrorJson: null,
  };
}

describe("POST /api/social/paid-campaigns/from-post", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset().mockResolvedValue(1);
    (getDb as jest.Mock).mockReset().mockResolvedValue({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockResolvedValue([[], []]),
    });
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(createPaidSocialCampaignDraftFromOrganicPost).mockReset();
    jest.mocked(listPaidSocialCampaignsByCampaign).mockReset().mockResolvedValue([]);
  });

  it("returns 401 when not authed", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await POST_HANDLER(
      new NextRequest("http://localhost/api/social/paid-campaigns/from-post", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, postId: POST }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 without campaign access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await POST_HANDLER(
      new NextRequest("http://localhost/api/social/paid-campaigns/from-post", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, postId: POST }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and projected draft on success", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const db = (await (getDb as jest.Mock)()) as never;
    jest.mocked(createPaidSocialCampaignDraftFromOrganicPost).mockResolvedValue(row);
    const res = await POST_HANDLER(
      new NextRequest("http://localhost/api/social/paid-campaigns/from-post", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, postId: POST }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; paidCampaign: unknown };
    expect(j.ok).toBe(true);
    expect(j.paidCampaign).toEqual(await projectPaidSocialCampaignPublic(db, row, CAMP));
    expect((j as { promotionDecisionSummary?: unknown }).promotionDecisionSummary).toBeUndefined();
    expect(createPaidSocialCampaignDraftFromOrganicPost).toHaveBeenCalledWith(db, {
      campaignId: CAMP,
      userId: 1,
      postId: POST,
    });
  });

  it("returns 409 duplicate_reference_organic_post when create throws DUPLICATE_REFERENCE_ORGANIC_POST", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const db = (await (getDb as jest.Mock)()) as never;
    jest.mocked(createPaidSocialCampaignDraftFromOrganicPost).mockRejectedValue(
      new PaidSocialCampaignError("DUPLICATE_REFERENCE_ORGANIC_POST", "A paid draft already references this organic post.", {
        existingCampaignId: CAMP,
        existingDraftId: PAID,
        existingStatus: "draft",
        existingName: "Promoted: x",
        paidCreativeSource: "organic_post",
      })
    );
    const res = await POST_HANDLER(
      new NextRequest("http://localhost/api/social/paid-campaigns/from-post", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, postId: POST }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(409);
    const j = (await res.json()) as Record<string, unknown>;
    expect(j).toEqual({
      ok: false,
      error: "duplicate_reference_organic_post",
      existingCampaignId: CAMP,
      existingDraftId: PAID,
      existingStatus: "draft",
      existingName: "Promoted: x",
    });
    expect(j).not.toHaveProperty("promotionDecisionSummary");
    expect(createPaidSocialCampaignDraftFromOrganicPost).toHaveBeenCalledWith(db, {
      campaignId: CAMP,
      userId: 1,
      postId: POST,
    });
  });

  it("POST includes promotionDecisionSummary when siblings include organic-linked drafts (Part 70)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const PID2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const r2: import("@/lib/db/schema").CampaignPaidSocialCampaignRow = {
      ...row,
      id: PID2,
      internalName: "Other",
    };
    const db = (await (getDb as jest.Mock)()) as never;
    jest.mocked(createPaidSocialCampaignDraftFromOrganicPost).mockResolvedValue(row);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([row, r2]);
    const listStub: PaidSocialCampaignPublic[] = [
      {
        id: PAID,
        referenceCampaignPostId: POST,
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      } as PaidSocialCampaignPublic,
      {
        id: PID2,
        referenceCampaignPostId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      } as PaidSocialCampaignPublic,
    ];
    jest.mocked(PaidCampaignsModule.projectPaidSocialCampaignsPublicForList).mockResolvedValueOnce(listStub);
    const res = await POST_HANDLER(
      new NextRequest("http://localhost/api/social/paid-campaigns/from-post", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, postId: POST }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    const expected = computePromotionDecisionSummaryForCampaign(listStub);
    expect(expected).toBeDefined();
    expect(j.promotionDecisionSummary).toEqual(expected);
    expect(j.promotionDecisionSummary?.topStatusLabel).toBe("promotion_effective");
  });
});
