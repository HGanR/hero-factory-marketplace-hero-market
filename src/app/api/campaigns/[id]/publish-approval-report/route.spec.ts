/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  campaignAuditEvents,
  campaignPosts,
  campaignReviewerAssignmentAuditEvents,
  type CampaignRow,
} from "@/lib/db/schema";

let adminCookie: string | undefined;

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn((name: string) =>
      name === "admin-token" && adminCookie ? { value: adminCookie } : undefined
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

describe("GET /api/campaigns/[id]/publish-approval-report", () => {
  let savedGovernanceTier: string | undefined;

  beforeEach(() => {
    savedGovernanceTier = process.env.REVENUE_OS_GOVERNANCE_TIER;
    adminCookie = undefined;
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
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-report"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
  });

  it("returns 403 FEATURE_NOT_AVAILABLE when plan tier blocks compliance export", async () => {
    process.env.REVENUE_OS_GOVERNANCE_TIER = "starter";
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "owner",
    });
    (getDb as jest.Mock).mockResolvedValue({});
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-report"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("returns 403 for non-owner without admin cookie", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "approver",
    });
    (getDb as jest.Mock).mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(async () => []),
        })),
      })),
    });
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-report"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("FORBIDDEN_REPORT");
  });

  it("returns JSON report for owner with expected top-level keys", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "owner",
    });

    (getDb as jest.Mock).mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn((tbl: unknown) => {
          if (tbl === campaignPosts) {
            return {
              where: jest.fn(async () => [{ id: "p1", utmParams: {} }]),
            };
          }
          if (tbl === campaignAuditEvents) {
            return {
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  orderBy: jest.fn(() => ({
                    limit: jest.fn(async () => []),
                  })),
                })),
              })),
            };
          }
          if (tbl === campaignReviewerAssignmentAuditEvents) {
            return {
              where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                  limit: jest.fn(async () => []),
                })),
              })),
            };
          }
          return { where: jest.fn(async () => []) };
        }),
      })),
    });

    const res = await GET(
      new NextRequest(
        "http://localhost/api/campaigns/camp-1/publish-approval-report?workerRequiresApproval=true&auditLimit=10"
      ),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      generatedAt: string;
      campaign: { campaignId: string };
      currentState?: { summary: { pendingApprovalCount: number } };
      publishApprovalAuditTail?: unknown[];
    };
    expect(j.campaign.campaignId).toBe("camp-1");
    expect(j.generatedAt).toBeTruthy();
    expect(j.currentState?.summary.pendingApprovalCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(j.publishApprovalAuditTail)).toBe(true);
  });

  it("returns CSV when format=csv for admin session", async () => {
    adminCookie = "yes";
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: campaignStub,
      reviewerRole: "approver",
    });
    (getDb as jest.Mock).mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn((tbl: unknown) => {
          if (tbl === campaignPosts) {
            return { where: jest.fn(async () => []) };
          }
          if (tbl === campaignAuditEvents) {
            return {
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => ({
                  orderBy: jest.fn(() => ({
                    limit: jest.fn(async () => []),
                  })),
                })),
              })),
            };
          }
          if (tbl === campaignReviewerAssignmentAuditEvents) {
            return {
              where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                  limit: jest.fn(async () => []),
                })),
              })),
            };
          }
          return { where: jest.fn(async () => []) };
        }),
      })),
    });

    const res = await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/publish-approval-report?format=csv"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("row_kind");
    expect(text).toContain("summary");
  });
});
