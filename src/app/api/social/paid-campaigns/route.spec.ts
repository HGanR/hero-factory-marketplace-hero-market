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
    listPaidSocialCampaignsByCampaign: jest.fn(),
    createPaidSocialCampaignDraft: jest.fn(),
    projectPaidSocialCampaignsPublicForList: jest.fn((...args: unknown[]) =>
      actual.projectPaidSocialCampaignsPublicForList(
        ...(args as Parameters<typeof actual.projectPaidSocialCampaignsPublicForList>)
      )
    ),
  };
});

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import type { PaidSocialCampaignPublic } from "@/lib/social/paid-social-campaigns";
import type {
  PaidCampaignListSuccessResponse,
  PaidCampaignSuccessResponse,
} from "@/lib/social/paid-campaign-api-response-types";
import * as PaidCampaignsModule from "@/lib/social/paid-social-campaigns";

const {
  computePromotionDecisionSummaryForCampaign,
  createPaidSocialCampaignDraft,
  listPaidSocialCampaignsByCampaign,
  projectPaidSocialCampaignPublic,
  projectPaidSocialCampaignsPublicForList,
  promotionDecisionTopStatusLabelText,
} = PaidCampaignsModule;
import { computePaidSocialRollupForCampaign } from "@/lib/social/paid-social-campaign-paid-rollup";
import { computePaidListSignalsSummary } from "@/lib/social/paid-social-optimization-signals";
import { computeOrganicPromotionOpportunitySummaryForCampaign } from "@/lib/social/organic-performance-signals";

const CAMP = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

let GET: typeof import("./route").GET;
let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ GET, POST } = await import("./route"));
});

/** Minimal Drizzle-like chain for `projectPaidSocialCampaignPublic` (snapshot + asset queries). */
function mockDbForPaidSocialProjection() {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    /** Part 55: list batch latest snapshots use `db.execute` (ROW_NUMBER subquery). */
    execute: jest.fn().mockResolvedValue([[], []]),
  };
}

function mockRow(partial: Partial<import("@/lib/db/schema").CampaignPaidSocialCampaignRow> = {}) {
  const base: import("@/lib/db/schema").CampaignPaidSocialCampaignRow = {
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
    createdByUserId: "1",
    updatedByUserId: "1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
    ...partial,
  };
  return base;
}

describe("/api/social/paid-campaigns GET", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(1);
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue(mockDbForPaidSocialProjection());
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(listPaidSocialCampaignsByCampaign).mockReset();
    jest.mocked(computeOrganicPromotionOpportunitySummaryForCampaign).mockClear();
  });

  it("returns 400 when campaignId invalid", async () => {
    const res = await GET(new NextRequest("http://localhost/api/social/paid-campaigns?campaignId=bad"));
    expect(res.status).toBe(400);
  });

  it("returns 404 without access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await GET(new NextRequest(`http://localhost/api/social/paid-campaigns?campaignId=${CAMP}`));
    expect(res.status).toBe(404);
  });

  it("returns projected list when access ok", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([row]);
    const res = await GET(new NextRequest(`http://localhost/api/social/paid-campaigns?campaignId=${CAMP}`));
    expect(res.status).toBe(200);
    const j = (await res.json()) as PaidCampaignListSuccessResponse;
    expect(j.ok).toBe(true);
    expect(j.paidCampaigns).toHaveLength(1);
    const listProjected = await projectPaidSocialCampaignsPublicForList(db, [row], CAMP);
    expect(j.paidCampaigns).toEqual(listProjected);
    expect(j.paidListSignalsSummary).toEqual(computePaidListSignalsSummary(listProjected));
    expect(j.paidRollup).toEqual(await computePaidSocialRollupForCampaign(db, CAMP));
    expect(j.organicPromotionOpportunitySummary).toEqual({
      topOrganicCandidateCount: 0,
      topSignalLabel: null,
    });
    expect(computeOrganicPromotionOpportunitySummaryForCampaign).toHaveBeenCalledWith(db, CAMP);
    const expectedSummary = computePromotionDecisionSummaryForCampaign(listProjected);
    if (expectedSummary == null) {
      expect(j.promotionDecisionSummary).toBeUndefined();
    } else {
      expect(j.promotionDecisionSummary).toEqual(expectedSummary);
    }
  });

  it("GET promotionDecisionSummary includes nonComparableReasonCounts when projected organic-linked rows have readiness reasons (Part 65)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([row]);
    const stub: PaidSocialCampaignPublic[] = [
      {
        id: PID,
        referenceCampaignPostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_sample" },
      } as PaidSocialCampaignPublic,
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        referenceCampaignPostId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" },
      } as PaidSocialCampaignPublic,
    ];
    jest.mocked(PaidCampaignsModule.projectPaidSocialCampaignsPublicForList).mockResolvedValueOnce(stub);
    const res = await GET(new NextRequest(`http://localhost/api/social/paid-campaigns?campaignId=${CAMP}`));
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      paidCampaigns: unknown[];
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    expect(j.paidCampaigns).toEqual(stub);
    expect(j.promotionDecisionSummary).toEqual(computePromotionDecisionSummaryForCampaign(stub));
    expect(j.promotionDecisionSummary?.explainabilityStatusText).toMatch(/Need at least 2 comparable/);
    expect(j.promotionDecisionSummary?.dominantNonComparableReason).toBeUndefined();
    expect(j.promotionDecisionSummary?.dominantNonComparableReasonText).toBeUndefined();
  });

  it("GET promotionDecisionSummary explainabilityStatus ready when topStatusLabel present (Part 66)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([row]);
    const eff = {
      paidOutperformingOrganic: true,
      paidUnderperformingOrganic: false,
      promotionEffective: true,
      promotionInefficient: false,
    };
    const stub: PaidSocialCampaignPublic[] = [
      {
        id: PID,
        referenceCampaignPostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: eff,
      } as PaidSocialCampaignPublic,
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        referenceCampaignPostId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: eff,
      } as PaidSocialCampaignPublic,
    ];
    jest.mocked(PaidCampaignsModule.projectPaidSocialCampaignsPublicForList).mockResolvedValueOnce(stub);
    const res = await GET(new NextRequest(`http://localhost/api/social/paid-campaigns?campaignId=${CAMP}`));
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      promotionDecisionSummary?: import("@/lib/social/paid-social-campaigns").PromotionDecisionSummary;
    };
    expect(j.promotionDecisionSummary?.topStatusLabel).toBe("promotion_effective");
    expect(j.promotionDecisionSummary?.topStatusLabelText).toBe(
      promotionDecisionTopStatusLabelText("promotion_effective")
    );
    expect(j.promotionDecisionSummary?.explainabilityStatus).toBe("ready");
    expect(j.promotionDecisionSummary?.explainabilityStatusText).toBeUndefined();
  });
});

describe("/api/social/paid-campaigns POST", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(1);
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue(mockDbForPaidSocialProjection());
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(createPaidSocialCampaignDraft).mockReset();
    jest.mocked(listPaidSocialCampaignsByCampaign).mockReset().mockResolvedValue([]);
  });

  it("returns 404 without access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/social/paid-campaigns", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, provider: "meta_ads" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns created projection", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const row = mockRow();
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(createPaidSocialCampaignDraft).mockResolvedValue(row);
    const res = await POST(
      new NextRequest("http://localhost/api/social/paid-campaigns", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, provider: "meta_ads" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as PaidCampaignSuccessResponse<
      Awaited<ReturnType<typeof projectPaidSocialCampaignPublic>>
    >;
    expect(j.ok).toBe(true);
    expect(j.paidCampaign).toEqual(await projectPaidSocialCampaignPublic(db, row, CAMP));
    expect(j.promotionDecisionSummary).toBeUndefined();
  });

  it("POST includes promotionDecisionSummary when siblings include organic-linked drafts (Part 70)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const POST_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const PID2 = "33333333-3333-4333-8333-333333333333";
    const row = mockRow();
    const r2 = mockRow({
      id: PID2,
      creativeConfigJson: { referenceOrganicPostId: POST_REF },
    });
    const db = mockDbForPaidSocialProjection();
    (getDb as jest.Mock).mockResolvedValue(db);
    jest.mocked(createPaidSocialCampaignDraft).mockResolvedValue(row);
    jest.mocked(listPaidSocialCampaignsByCampaign).mockResolvedValue([row, r2]);
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
    jest.mocked(PaidCampaignsModule.projectPaidSocialCampaignsPublicForList).mockResolvedValueOnce(listStub);
    const res = await POST(
      new NextRequest("http://localhost/api/social/paid-campaigns", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, provider: "meta_ads" }),
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
    expect(j.promotionDecisionSummary?.referencedOrganicCount).toBe(2);
  });

  it("returns 403 when Revenue OS gate blocks", async () => {
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValueOnce(
      NextResponse.json({ error: "REVENUE_OS_ACCESS_DENIED" }, { status: 403 })
    );
    const res = await POST(
      new NextRequest("http://localhost/api/social/paid-campaigns", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, provider: "meta_ads" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(403);
  });
});
