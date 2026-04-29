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
jest.mock("@/lib/social/perform-operator-external-review-token-mint", () => ({
  computeSocialReviewTokenOrigin: jest.fn(() => "https://app.example"),
  performOperatorExternalReviewTokenMint: jest.fn(),
}));
jest.mock("@/lib/social/external-social-review-audit", () => ({
  ...jest.requireActual<typeof import("@/lib/social/external-social-review-audit")>(
    "@/lib/social/external-social-review-audit"
  ),
  insertExternalReviewLinkAuditEvent: jest.fn().mockResolvedValue(undefined),
  resolveExternalReviewAuditPostId: jest.fn().mockResolvedValue("p-post"),
}));
jest.mock("@/services/email-notification-service", () => ({
  EmailNotificationService: jest.fn(),
}));

import { describe, it, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { insertExternalReviewLinkAuditEvent } from "@/lib/social/external-social-review-audit";
import { performOperatorExternalReviewTokenMint } from "@/lib/social/perform-operator-external-review-token-mint";
import { EmailNotificationService } from "@/services/email-notification-service";

const CAMP = "22222222-2222-4222-8222-222222222222";

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

describe("/api/social/external-review-link-email POST", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    jest.mocked(getAuthedUserId).mockResolvedValue(1);
    (getDb as jest.Mock).mockReset();
    (getDb as jest.Mock).mockResolvedValue({});
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
    jest.mocked(getCampaignReviewerAccess).mockReset();
    jest.mocked(performOperatorExternalReviewTokenMint).mockReset();
    jest.mocked(insertExternalReviewLinkAuditEvent).mockClear();
    jest.mocked(EmailNotificationService).mockReset();
    jest.mocked(EmailNotificationService).mockImplementation(
      () => ({ send: jest.fn().mockResolvedValue({ success: true }) }) as unknown as InstanceType<typeof EmailNotificationService>
    );
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/social/external-review-link-email", {
        method: "POST",
        body: JSON.stringify({
          campaignId: CAMP,
          recipientEmail: "not-an-email",
          contextPostId: "33333333-3333-4333-8333-333333333333",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("mints, sends, and records email audit on success", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "Spring push" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(performOperatorExternalReviewTokenMint).mockResolvedValue({
      id: "tok-email-1",
      rawToken: "abc",
      reviewUrl: "https://app.example/review/social-publish?t=abc",
      expiresAt: null,
      roles: ["approver"],
      label: "Round 1",
    });
    const sendFn = jest.fn().mockResolvedValue({ success: true });
    jest.mocked(EmailNotificationService).mockImplementation(
      () => ({ send: sendFn }) as unknown as InstanceType<typeof EmailNotificationService>
    );

    const res = await POST(
      new NextRequest("http://localhost/api/social/external-review-link-email", {
        method: "POST",
        body: JSON.stringify({
          campaignId: CAMP,
          recipientEmail: "client@example.com",
          recipientName: "Sam",
          contextPostId: "33333333-3333-4333-8333-333333333333",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean; tokenId: string };
    expect(j.ok).toBe(true);
    expect(j.tokenId).toBe("tok-email-1");
    expect(performOperatorExternalReviewTokenMint).toHaveBeenCalled();
    expect(jest.mocked(insertExternalReviewLinkAuditEvent)).toHaveBeenCalled();
    expect(sendFn).toHaveBeenCalled();
    const sendArg = sendFn.mock.calls[0][0] as { body: string };
    expect(sendArg.body).toContain("https://app.example/review/social-publish?t=abc");
    expect(sendArg.body).toContain("Open review page");
    expect(sendArg.body).toContain("Spring push");
  });

  it("returns 502 when send fails but reports tokenId", async () => {
    jest.mocked(getCampaignReviewerAccess).mockResolvedValue({
      campaign: { id: CAMP, name: "N" } as import("@/lib/db/schema").CampaignRow,
      reviewerRole: "owner",
    });
    jest.mocked(performOperatorExternalReviewTokenMint).mockResolvedValue({
      id: "tok-fail",
      rawToken: "x",
      reviewUrl: "https://x",
      expiresAt: null,
      roles: ["approver"],
      label: null,
    });
    jest.mocked(EmailNotificationService).mockImplementation(
      () =>
        ({ send: jest.fn().mockResolvedValue({ success: false, error: "SES down" }) }) as unknown as InstanceType<
          typeof EmailNotificationService
        >
    );

    const res = await POST(
      new NextRequest("http://localhost/api/social/external-review-link-email", {
        method: "POST",
        body: JSON.stringify({
          campaignId: CAMP,
          recipientEmail: "client@example.com",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(502);
    const j = (await res.json()) as { tokenId?: string };
    expect(j.tokenId).toBe("tok-fail");
    expect(jest.mocked(insertExternalReviewLinkAuditEvent)).not.toHaveBeenCalled();
  });
});
