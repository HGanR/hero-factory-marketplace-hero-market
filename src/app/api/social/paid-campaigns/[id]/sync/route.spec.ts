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
jest.mock("@/lib/social/paid-social-campaign-meta-sync", () => ({
  syncPaidSocialMetaCampaign: jest.fn(),
  PaidSocialSyncError: class PaidSocialSyncError extends Error {
    readonly code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
    }
  },
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import { syncPaidSocialMetaCampaign, PaidSocialSyncError } from "@/lib/social/paid-social-campaign-meta-sync";

const CAMP = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

let GET: typeof import("./route").GET;

beforeAll(async () => {
  ({ GET } = await import("./route"));
});

describe("GET /api/social/paid-campaigns/[id]/sync", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset().mockResolvedValue(1);
    (getDb as jest.Mock).mockReset().mockResolvedValue({});
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(syncPaidSocialMetaCampaign).mockReset();
    jest.mocked(buildPromotionDecisionSummaryForPaidCampaignContext).mockReset().mockResolvedValue(undefined);
  });

  it("returns 400 without campaignId", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    const res = await GET(new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/sync`), {
      params: Promise.resolve({ id: PID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 without access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/sync?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when sync disabled", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(syncPaidSocialMetaCampaign).mockRejectedValue(new PaidSocialSyncError("SYNC_DISABLED", "off"));
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/sync?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with payload on success", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue({
      ok: true,
      paidCampaign: { id: PID } as never,
      sync: { snapshotInserted: true, runtimeStatus: "active", warningCount: 0, phasesWithErrors: [] },
    });
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/sync?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; sync: { snapshotInserted: boolean } };
    expect(j.ok).toBe(true);
    expect(j.sync.snapshotInserted).toBe(true);
  });

  it("includes promotionDecisionSummary on success when applicable (Part 73)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue({
      ok: true,
      paidCampaign: { id: PID } as never,
      sync: { snapshotInserted: true, runtimeStatus: "active", warningCount: 0, phasesWithErrors: [] },
    });
    const summary = {
      referencedOrganicCount: 1,
      comparableCount: 0,
      effectiveCount: 0,
      inefficientCount: 0,
      notReadyCount: 1,
      explainabilityStatus: "insufficient_comparable_rows" as const,
      explainabilityStatusText: "Need at least 2 comparable linked drafts for a campaign-level promotion summary.",
    };
    jest.mocked(buildPromotionDecisionSummaryForPaidCampaignContext).mockResolvedValue(summary);
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/sync?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; promotionDecisionSummary?: typeof summary };
    expect(j.promotionDecisionSummary).toEqual(summary);
    expect(buildPromotionDecisionSummaryForPaidCampaignContext).toHaveBeenCalledWith({}, CAMP);
  });

  it("omits promotionDecisionSummary when helper returns undefined (Part 73)", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(syncPaidSocialMetaCampaign).mockResolvedValue({
      ok: true,
      paidCampaign: { id: PID } as never,
      sync: { snapshotInserted: false, runtimeStatus: "active", warningCount: 0, phasesWithErrors: [] },
    });
    jest.mocked(buildPromotionDecisionSummaryForPaidCampaignContext).mockResolvedValue(undefined);
    const res = await GET(
      new NextRequest(`http://localhost/api/social/paid-campaigns/${PID}/sync?campaignId=${CAMP}`),
      { params: Promise.resolve({ id: PID }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { promotionDecisionSummary?: unknown };
    expect(j.promotionDecisionSummary).toBeUndefined();
  });
});
