/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildExternalReviewOperatorApiSummary } from "@/lib/social/external-social-review-operator-db";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");
jest.mock("@/lib/revenue-os/get-campaign-reviewer-access");
jest.mock("@/lib/social/external-social-review-operator-db", () => ({
  buildExternalReviewOperatorApiSummary: jest.fn(),
}));
jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null),
}));

const CAMP = "11111111-1111-4111-8111-111111111111";

describe("/api/social/external-review-tokens GET", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(1);
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue({});
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(buildExternalReviewOperatorApiSummary).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
  });

  it("returns 403 when Revenue OS gate blocks", async () => {
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValueOnce(
      NextResponse.json({ error: "REVENUE_OS_ACCESS_DENIED" }, { status: 403 })
    );
    const res = await GET(
      new NextRequest(`http://localhost/api/social/external-review-tokens?campaignId=${CAMP}`)
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when campaignId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/social/external-review-tokens"));
    expect(res.status).toBe(400);
  });

  it("returns summary when access ok", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: {
        id: CAMP,
        clientId: "cli",
        userId: "1",
        name: "C",
        publishApprovalChainJson: null,
      } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(buildExternalReviewOperatorApiSummary).mockResolvedValue({
      tokens: [],
      primaryActiveToken: null,
      activeTokenCount: 0,
      lastExternalClientReview: null,
      postContext: null,
    });
    const res = await GET(
      new NextRequest(`http://localhost/api/social/external-review-tokens?campaignId=${CAMP}`)
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; activeTokenCount: number };
    expect(j.ok).toBe(true);
    expect(j.activeTokenCount).toBe(0);
  });
});
