/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import type { CampaignRow } from "@/lib/db/schema";
import {
  BENTLEY_UTM_APPROVAL_STATUS,
  BENTLEY_UTM_APPROVAL_STEP_STARTED_AT,
} from "@/lib/revenue-os/publish-approval-utm";

let adminCookieValue: string | undefined;

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn((name: string) =>
      name === "admin-token" && adminCookieValue ? { value: adminCookieValue } : undefined
    ),
  })),
}));

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");
jest.mock("@/lib/revenue-os/get-campaign-reviewer-access");

const campaignStub = {
  id: "camp-1",
  userId: "9",
  name: "Camp",
  clientId: "cl-1",
  publishApprovalChainJson: null,
} as CampaignRow;

function setupDbSelectRows(rows: { id: string; utmParams: unknown }[]) {
  const where = jest.fn(async () => rows);
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
  return { select, where };
}

describe("GET /api/campaigns/[id]/publish-approval-analytics", () => {
  let savedGovernanceTier: string | undefined;

  beforeEach(() => {
    savedGovernanceTier = process.env.REVENUE_OS_GOVERNANCE_TIER;
    adminCookieValue = undefined;
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(getCampaignReviewerAccess).mockReset();
  });

  afterEach(() => {
    if (savedGovernanceTier === undefined) delete process.env.REVENUE_OS_GOVERNANCE_TIER;
    else process.env.REVENUE_OS_GOVERNANCE_TIER = savedGovernanceTier;
  });

  it("returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-analytics"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
  });

  it("returns 404 when campaign access missing", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue(null);
    const res = await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-analytics"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 FEATURE_NOT_AVAILABLE when plan tier blocks approval analytics", async () => {
    process.env.REVENUE_OS_GOVERNANCE_TIER = "starter";
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "owner",
    });
    (getDb as jest.Mock).mockResolvedValue({});
    const res = await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-analytics"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: string; message?: string };
    expect(j.error).toBe("FEATURE_NOT_AVAILABLE");
    expect(j.message).toContain("not available");
  });

  it("returns 403 FORBIDDEN_ANALYTICS for non-owner without admin cookie", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "approver",
    });
    setupDbSelectRows([]);
    const res = await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-analytics"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("FORBIDDEN_ANALYTICS");
  });

  it("returns 200 for owner with summary and stalled posts ordered by age", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "owner",
    });
    const base = "2026-04-05T12:00:00.000Z";
    setupDbSelectRows([
      {
        id: "young",
        utmParams: {
          [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
          [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: new Date(new Date(base).getTime() - 5 * 3600000).toISOString(),
        },
      },
      {
        id: "old",
        utmParams: {
          [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
          [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: new Date(new Date(base).getTime() - 40 * 3600000).toISOString(),
        },
      },
    ]);
    const res = await GET(
      new NextRequest(
        `http://localhost/api/campaigns/camp-1/publish-approval-analytics?workerRequiresApproval=true`
      ),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      summary: { pendingApprovalCount: number; byRole: Record<string, number> };
      stalledPosts: { postId: string; approvalStepAgeMs: number | null }[];
    };
    expect(j.summary.pendingApprovalCount).toBe(2);
    expect(j.stalledPosts[0]!.postId).toBe("old");
    expect(j.stalledPosts[1]!.postId).toBe("young");
    expect(j.stalledPosts[0]!.approvalStepAgeMs).toBeGreaterThan(j.stalledPosts[1]!.approvalStepAgeMs!);
  });

  it("returns 200 for approver when admin-token cookie is set", async () => {
    adminCookieValue = "yes";
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "approver",
    });
    setupDbSelectRows([]);
    const res = await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-analytics"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { summary: { pendingApprovalCount: number } };
    expect(j.summary.pendingApprovalCount).toBe(0);
  });

  it("respects stalledLimit query for slice size", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "owner",
    });
    const base = "2026-04-05T12:00:00.000Z";
    setupDbSelectRows(
      [1, 2, 3, 4].map((i) => ({
        id: `p${i}`,
        utmParams: {
          [BENTLEY_UTM_APPROVAL_STATUS]: "pending_approval",
          [BENTLEY_UTM_APPROVAL_STEP_STARTED_AT]: new Date(new Date(base).getTime() - i * 3600000).toISOString(),
        },
      }))
    );
    const res = await GET(
      new NextRequest(
        "http://localhost/api/campaigns/camp-1/publish-approval-analytics?workerRequiresApproval=true&stalledLimit=2"
      ),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { stalledPosts: unknown[] };
    expect(j.stalledPosts).toHaveLength(2);
  });
});
