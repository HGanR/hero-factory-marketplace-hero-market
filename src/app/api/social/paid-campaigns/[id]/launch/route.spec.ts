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
jest.mock("@/lib/social/build-promotion-decision-summary-for-paid-campaign-context", () => ({
  buildPromotionDecisionSummaryForPaidCampaignContext: jest.fn(),
}));
jest.mock("@/lib/social/paid-social-campaign-launch", () => ({
  executePaidSocialMetaLaunch: jest.fn(),
  PaidSocialLaunchError: class PaidSocialLaunchError extends Error {
    readonly code: string;
    readonly details?: unknown;
    constructor(code: string, message?: string, details?: unknown) {
      super(message ?? code);
      this.code = code;
      this.details = details;
    }
  },
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import { executePaidSocialMetaLaunch, PaidSocialLaunchError } from "@/lib/social/paid-social-campaign-launch";

const CAMP = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("POST /api/social/paid-campaigns/[id]/launch", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset().mockResolvedValue(1);
    (getDb as jest.Mock).mockReset().mockResolvedValue({});
    jest.mocked(enforceRevenueOsApiAccess).mockReset().mockResolvedValue(null);
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(executePaidSocialMetaLaunch).mockReset();
    jest.mocked(buildPromotionDecisionSummaryForPaidCampaignContext).mockReset().mockResolvedValue(undefined);
  });

  it("returns 400 when body invalid", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 without campaign access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when Revenue OS gate blocks", async () => {
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValueOnce(
      NextResponse.json({ error: "REVENUE_OS_ACCESS_DENIED" }, { status: 403 })
    );
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when launch service reports feature disabled", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest
      .mocked(executePaidSocialMetaLaunch)
      .mockRejectedValue(new PaidSocialLaunchError("LAUNCH_DISABLED", "flag off"));
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("LAUNCH_DISABLED");
  });

  it("returns 409 when already launched", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest
      .mocked(executePaidSocialMetaLaunch)
      .mockRejectedValue(new PaidSocialLaunchError("ALREADY_LAUNCHED", "exists"));
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(409);
  });

  it("returns 200 with paidCampaign on success", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const paidCampaign = { id: PID, campaignId: CAMP, metaLaunchStatus: "launched" };
    jest.mocked(executePaidSocialMetaLaunch).mockResolvedValue({ ok: true, paidCampaign } as never);
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; paidCampaign: typeof paidCampaign };
    expect(j.ok).toBe(true);
    expect(j.paidCampaign).toEqual(paidCampaign);
    expect(executePaidSocialMetaLaunch).toHaveBeenCalledWith({}, { paidCampaignId: PID, campaignId: CAMP, userId: 1 });
  });

  it("includes promotionDecisionSummary on success when campaign has organic-linked drafts (Part 73)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const paidCampaign = { id: PID, campaignId: CAMP, metaLaunchStatus: "launched" };
    jest.mocked(executePaidSocialMetaLaunch).mockResolvedValue({ ok: true, paidCampaign } as never);
    const summary = {
      referencedOrganicCount: 2,
      comparableCount: 2,
      effectiveCount: 1,
      inefficientCount: 0,
      notReadyCount: 0,
      topStatusLabel: "mixed" as const,
      topStatusLabelText: "Promotion results are mixed",
    };
    jest.mocked(buildPromotionDecisionSummaryForPaidCampaignContext).mockResolvedValue(summary);
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; promotionDecisionSummary?: typeof summary };
    expect(j.ok).toBe(true);
    expect(j.promotionDecisionSummary).toEqual(summary);
    expect(buildPromotionDecisionSummaryForPaidCampaignContext).toHaveBeenCalledWith({}, CAMP);
  });

  it("omits promotionDecisionSummary on success when helper returns undefined (Part 73)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const paidCampaign = { id: PID, campaignId: CAMP, metaLaunchStatus: "launched" };
    jest.mocked(executePaidSocialMetaLaunch).mockResolvedValue({ ok: true, paidCampaign } as never);
    jest.mocked(buildPromotionDecisionSummaryForPaidCampaignContext).mockResolvedValue(undefined);
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { promotionDecisionSummary?: unknown };
    expect(j.promotionDecisionSummary).toBeUndefined();
  });

  it("returns 502 on Meta API failure", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest
      .mocked(executePaidSocialMetaLaunch)
      .mockRejectedValue(new PaidSocialLaunchError("META_API", "Graph error", { status: 400 }));
    const res = await POST(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/launch`, {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(502);
  });
});
