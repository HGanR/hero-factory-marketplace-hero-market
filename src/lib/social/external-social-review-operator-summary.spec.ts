import { describe, it, expect } from "@jest/globals";
import {
  findLastExternalClientReviewFromAuditRows,
  pickPrimaryActiveToken,
  resolveExternalReviewTokenOperatorStatus,
  mapTokenRowToOperatorRow,
} from "@/lib/social/external-social-review-operator-summary";

describe("external-social-review-operator-summary", () => {
  it("resolveExternalReviewTokenOperatorStatus", () => {
    expect(resolveExternalReviewTokenOperatorStatus({ revokedAt: new Date(), expiresAt: null })).toBe("revoked");
    expect(
      resolveExternalReviewTokenOperatorStatus({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86_400_000),
      })
    ).toBe("expired");
    expect(resolveExternalReviewTokenOperatorStatus({ revokedAt: null, expiresAt: null })).toBe("active");
    expect(
      resolveExternalReviewTokenOperatorStatus({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
    ).toBe("active");
  });

  it("pickPrimaryActiveToken chooses newest active by createdAt", () => {
    const a = mapTokenRowToOperatorRow({
      id: "a",
      label: null,
      allowedRolesJson: ["approver"],
      createdByUserId: "1",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
    });
    const b = mapTokenRowToOperatorRow({
      id: "b",
      label: null,
      allowedRolesJson: ["approver"],
      createdByUserId: "1",
      createdAt: "2026-02-01T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
    });
    expect(pickPrimaryActiveToken([a, b])?.id).toBe("b");
  });

  it("findLastExternalClientReviewFromAuditRows scans newest-first list", () => {
    const hit = findLastExternalClientReviewFromAuditRows([
      {
        action: "publish_approval_approved",
        postId: "p1",
        details: {},
        createdAt: "2026-06-02T00:00:00.000Z",
      },
      {
        action: "publish_approval_rejected",
        postId: "p2",
        details: { reviewSurface: "external_social_review" },
        createdAt: "2026-06-03T00:00:00.000Z",
      },
    ]);
    expect(hit?.decision).toBe("rejected");
    expect(hit?.postId).toBe("p2");
  });
});
