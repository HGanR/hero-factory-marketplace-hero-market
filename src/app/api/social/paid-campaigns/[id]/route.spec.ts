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
jest.mock("@/lib/social/organic-performance-signals", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/organic-performance-signals")>(
    "@/lib/social/organic-performance-signals"
  );
  return {
    ...actual,
    computeOrganicPromotionOpportunitySummaryForCampaign: jest.fn().mockResolvedValue({
      topOrganicCandidateCount: 0,
      topSignalLabel: null,
    }),
  };
});
jest.mock("@/lib/social/paid-social-campaigns", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-campaigns")>(
    "@/lib/social/paid-social-campaigns"
  );
  return {
    ...actual,
    getPaidSocialCampaignById: jest.fn(),
    patchPaidSocialCampaign: jest.fn(),
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
import {
  computePromotionDecisionSummaryForCampaign,
  getPaidSocialCampaignById,
  listPaidSocialCampaignsByCampaign,
  patchPaidSocialCampaign,
  projectPaidSocialCampaignPublic,
  projectPaidSocialCampaignsPublicForList,
  PaidSocialCampaignError,
  type PaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";
import type { PaidCampaignSuccessResponse } from "@/lib/social/paid-campaign-api-response-types";

const CAMP = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

let GET: typeof import("./route").GET;
let PATCH: typeof import("./route").PATCH;
let listPaidCampaignsGET: typeof import("../route").GET;

beforeAll(async () => {
  ({ GET, PATCH } = await import("./route"));
  ({ GET: listPaidCampaignsGET } = await import("../route"));
});

function mockDbForPaidSocialProjection() {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue([[], []]),
  };
}

function mockRow(
  partial: Partial<import("@/lib/db/schema").CampaignPaidSocialCampaignRow> = {}
): import("@/lib/db/schema").CampaignPaidSocialCampaignRow {
  return {
    id: PID,
    campaignId: CAMP,
    provider: "meta_ads",
    internalName: "P",
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
    creativeConfigJson: null,
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
    createdByUserId: "1",
    updatedByUserId: "1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("/api/social/paid-campaigns/[id] GET", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset().mockResolvedValue(1);
    (getDb as jest.Mock).mockReset().mockResolvedValue(mockDbForPaidSocialProjection());
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(getPaidSocialCampaignById).mockReset();
    jest.mocked(listPaidSocialCampaignsByCampaign).mockReset().mockResolvedValue([]);
  });

  it("returns 400 without campaignId query", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const res = await GET(new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}`), {
      params: Promise.resolve({ id: PID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns paid campaign when scoped to campaign", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(getPaidSocialCampaignById).mockResolvedValue(row);
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as PaidCampaignSuccessResponse;
    expect(j.ok).toBe(true);
    expect(j.paidCampaign).toEqual(await projectPaidSocialCampaignPublic(db, row, CAMP));
    expect(j.promotionDecisionSummary).toBeUndefined();
  });

  it("includes promotionDecisionSummary when campaign has organic-linked paid drafts (Part 68)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const PID2 = "33333333-3333-4333-8333-333333333333";
    const r1 = mockRow({
      id: PID,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const r2 = mockRow({
      id: PID2,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(getPaidSocialCampaignById).mockResolvedValue(r1);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([r1, r2]);
    const listStub: PaidSocialCampaignPublic[] = [
      {
        id: PID,
        referenceCampaignPostId: POST_REF,
        crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_sample" },
      } as PaidSocialCampaignPublic,
      {
        id: PID2,
        referenceCampaignPostId: POST_REF,
        crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" },
      } as PaidSocialCampaignPublic,
    ];
    jest.mocked(projectPaidSocialCampaignsPublicForList).mockResolvedValueOnce(listStub);
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as PaidCampaignSuccessResponse;
    const expected = computePromotionDecisionSummaryForCampaign(listStub);
    expect(expected).toBeDefined();
    expect(j.promotionDecisionSummary).toEqual(expected);
    expect(j.promotionDecisionSummary?.referencedOrganicCount).toBe(2);
    expect(j.promotionDecisionSummary?.nonComparableReasonCounts).toEqual({
      insufficient_sample: 1,
      window_too_early: 1,
    });
    expect(j.promotionDecisionSummary?.explainabilityStatusText).toMatch(/Need at least 2 comparable/);
  });

  it("omits promotionDecisionSummary when no organic-linked drafts in campaign list (Part 68)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const r1 = mockRow({ id: PID });
    const r2 = mockRow({ id: "33333333-3333-4333-8333-333333333333" });
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(getPaidSocialCampaignById).mockResolvedValue(r1);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([r1, r2]);
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as PaidCampaignSuccessResponse;
    expect(j.promotionDecisionSummary).toBeUndefined();
  });

  it("detail GET promotionDecisionSummary matches list GET for same campaign rows (Part 68 parity)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const PID2 = "33333333-3333-4333-8333-333333333333";
    const r1 = mockRow({
      id: PID,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const r2 = mockRow({
      id: PID2,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(getPaidSocialCampaignById).mockResolvedValue(r1);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([r1, r2]);
    const listStub: PaidSocialCampaignPublic[] = [
      {
        id: PID,
        referenceCampaignPostId: POST_REF,
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
        referenceCampaignPostId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      } as PaidSocialCampaignPublic,
    ];
    jest
      .mocked(projectPaidSocialCampaignsPublicForList)
      .mockResolvedValueOnce(listStub)
      .mockResolvedValueOnce(listStub);

    const detailRes = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    const listRes = await listPaidCampaignsGET(
      new NextRequest(`http://localhost/api/social/paid-campaigns?campaignId=${CAMP}`)
    );
    expect(detailRes.status).toBe(200);
    expect(listRes.status).toBe(200);
    const jd = (await detailRes.json()) as {
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    const jl = (await listRes.json()) as {
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    expect(jd.promotionDecisionSummary).toEqual(jl.promotionDecisionSummary);
    expect(jd.promotionDecisionSummary).toEqual(computePromotionDecisionSummaryForCampaign(listStub));
  });
});

describe("/api/social/paid-campaigns/[id] PATCH", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset().mockResolvedValue(1);
    (getDb as jest.Mock).mockReset().mockResolvedValue(mockDbForPaidSocialProjection());
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(patchPaidSocialCampaign).mockReset();
    jest.mocked(listPaidSocialCampaignsByCampaign).mockReset().mockResolvedValue([]);
  });

  it("returns 400 when asset not in campaign", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest
      .mocked(patchPaidSocialCampaign)
      .mockRejectedValue(new PaidSocialCampaignError("ASSET_NOT_IN_CAMPAIGN"));
    const res = await PATCH(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}`, {
        method: "PATCH",
        body: JSON.stringify({
          campaignId: CAMP,
          creative: { primaryAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns updated projection on success", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    row.objective = "awareness";
    jest.mocked(patchPaidSocialCampaign).mockResolvedValue(row);
    const res = await PATCH(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}`, {
        method: "PATCH",
        body: JSON.stringify({ campaignId: CAMP, objective: "awareness" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      paidCampaign: { objective: string };
      promotionDecisionSummary?: unknown;
    };
    expect(j.paidCampaign.objective).toBe("awareness");
    expect(j.promotionDecisionSummary).toBeUndefined();
  });

  it("PATCH includes promotionDecisionSummary when siblings include organic-linked drafts (Part 69)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const PID2 = "33333333-3333-4333-8333-333333333333";
    const r1 = mockRow({
      id: PID,
      objective: "awareness",
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const r2 = mockRow({
      id: PID2,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([r1, r2]);
    const listStub: PaidSocialCampaignPublic[] = [
      {
        id: PID,
        referenceCampaignPostId: POST_REF,
        crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_sample" },
      } as PaidSocialCampaignPublic,
      {
        id: PID2,
        referenceCampaignPostId: POST_REF,
        crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" },
      } as PaidSocialCampaignPublic,
    ];
    jest.mocked(projectPaidSocialCampaignsPublicForList).mockResolvedValueOnce(listStub);
    jest.mocked(patchPaidSocialCampaign).mockResolvedValue(r1);
    const res = await PATCH(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}`, {
        method: "PATCH",
        body: JSON.stringify({ campaignId: CAMP, objective: "awareness" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      ok: boolean;
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    const expected = computePromotionDecisionSummaryForCampaign(listStub);
    expect(expected).toBeDefined();
    expect(j.promotionDecisionSummary).toEqual(expected);
    expect(j.promotionDecisionSummary?.referencedOrganicCount).toBe(2);
  });

  it("PATCH promotionDecisionSummary matches GET for same campaign context (Part 69 parity)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const PID2 = "33333333-3333-4333-8333-333333333333";
    const r1 = mockRow({
      id: PID,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const r2 = mockRow({
      id: PID2,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(getPaidSocialCampaignById).mockResolvedValue(r1);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([r1, r2]);
    const listStub: PaidSocialCampaignPublic[] = [
      {
        id: PID,
        referenceCampaignPostId: POST_REF,
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
        referenceCampaignPostId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      } as PaidSocialCampaignPublic,
    ];
    jest
      .mocked(projectPaidSocialCampaignsPublicForList)
      .mockResolvedValueOnce(listStub)
      .mockResolvedValueOnce(listStub);
    jest.mocked(patchPaidSocialCampaign).mockResolvedValue(r1);

    const patchRes = await PATCH(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}`, {
        method: "PATCH",
        body: JSON.stringify({ campaignId: CAMP, objective: "traffic" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    const getRes = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(patchRes.status).toBe(200);
    expect(getRes.status).toBe(200);
    const jp = (await patchRes.json()) as {
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    const jg = (await getRes.json()) as {
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    expect(jp.promotionDecisionSummary).toEqual(jg.promotionDecisionSummary);
    expect(jp.promotionDecisionSummary).toEqual(computePromotionDecisionSummaryForCampaign(listStub));
  });
});
