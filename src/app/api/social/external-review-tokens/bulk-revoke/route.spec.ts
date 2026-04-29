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
jest.mock("@/lib/social/bulk-revoke-external-review-tokens", () => ({
  bulkRevokeExternalReviewTokensForCampaign: jest.fn(),
}));
jest.mock("@/lib/social/external-social-review-audit", () => ({
  ...jest.requireActual<typeof import("@/lib/social/external-social-review-audit")>(
    "@/lib/social/external-social-review-audit"
  ),
  insertExternalReviewLinkAuditEvent: jest.fn().mockResolvedValue(undefined),
  resolveExternalReviewAuditPostId: jest.fn().mockResolvedValue(null),
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { bulkRevokeExternalReviewTokensForCampaign } from "@/lib/social/bulk-revoke-external-review-tokens";
import { insertExternalReviewLinkAuditEvent, EXTERNAL_REVIEW_LINKS_BULK_REVOKED_ACTION } from "@/lib/social/external-social-review-audit";

const CAMP = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";

let routePOST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST: routePOST } = await import("./route"));
});

describe("/api/social/external-review-tokens/bulk-revoke POST", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(7);
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue({});
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(bulkRevokeExternalReviewTokensForCampaign).mockReset();
    jest.mocked(insertExternalReviewLinkAuditEvent).mockClear();
  });

  it("returns 400 when campaignId invalid", async () => {
    const res = await routePOST(
      new NextRequest("http://localhost/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        body: JSON.stringify({ campaignId: "bad", mode: "all_active" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authed", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await routePOST(
      new NextRequest("http://localhost/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, mode: "all_active" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when no campaign access", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    jest.mocked(bulkRevokeExternalReviewTokensForCampaign).mockResolvedValue({
      revokedCount: 0,
      revokedTokenIds: [],
      remainingActiveCount: 0,
    });
    const res = await routePOST(
      new NextRequest("http://localhost/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, mode: "all_active" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(404);
    expect(bulkRevokeExternalReviewTokensForCampaign).not.toHaveBeenCalled();
  });

  it("all_active: returns counts and writes one summary audit when revoked > 0", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "C" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(bulkRevokeExternalReviewTokensForCampaign).mockResolvedValue({
      revokedCount: 2,
      revokedTokenIds: ["a", "b"],
      remainingActiveCount: 0,
    });

    const res = await routePOST(
      new NextRequest("http://localhost/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, mode: "all_active", contextPostId: POST }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { revokedCount: number; remainingActiveCount: number; revokedTokenIds: string[] };
    expect(j.revokedCount).toBe(2);
    expect(j.remainingActiveCount).toBe(0);
    expect(j.revokedTokenIds).toEqual(["a", "b"]);
    expect(bulkRevokeExternalReviewTokensForCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: CAMP, mode: "all_active" })
    );
    expect(insertExternalReviewLinkAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: EXTERNAL_REVIEW_LINKS_BULK_REVOKED_ACTION,
        details: expect.objectContaining({ revokedCount: 2, mode: "all_active", campaignId: CAMP }),
      })
    );
  });

  it("all_except_primary: delegates mode and skips audit when nothing revoked", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "C" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(bulkRevokeExternalReviewTokensForCampaign).mockResolvedValue({
      revokedCount: 0,
      revokedTokenIds: [],
      remainingActiveCount: 1,
    });

    const res = await routePOST(
      new NextRequest("http://localhost/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, mode: "all_except_primary" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    expect(bulkRevokeExternalReviewTokensForCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "all_except_primary" })
    );
    expect(insertExternalReviewLinkAuditEvent).not.toHaveBeenCalled();
  });

  it("returns Revenue OS gate when enforceRevenueOsApiAccess returns a response", async () => {
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValueOnce(
      NextResponse.json({ error: "REVENUE_OS_ACCESS_DENIED" }, { status: 403 })
    );
    const res = await routePOST(
      new NextRequest("http://localhost/api/social/external-review-tokens/bulk-revoke", {
        method: "POST",
        body: JSON.stringify({ campaignId: CAMP, mode: "all_active" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(403);
    expect(getCampaignReviewerAccess).not.toHaveBeenCalled();
  });
});
