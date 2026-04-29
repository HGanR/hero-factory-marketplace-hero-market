import { describe, it, expect } from "@jest/globals";
import { planSocialPostPatchAuditRows, truncateForAudit } from "@/lib/social/social-post-patch-audit";

const actor = { userId: 1, label: "Op", role: "operator" };

function baseFieldDelta(overrides?: Partial<Parameters<typeof planSocialPostPatchAuditRows>[0]["fieldDelta"]>) {
  return {
    content: { changed: false, prevLength: 0, nextLength: 0 },
    schedule: { changed: false, prevIso: null, nextIso: null },
    link: { changed: false, prevTruncated: null, nextTruncated: null },
    account: { changed: false, prevAccountId: null, nextAccountId: null },
    asset: { changed: false, prevAssetId: null, nextAssetId: null },
    ...overrides,
  };
}

describe("social-post-patch-audit", () => {
  it("truncateForAudit caps long strings", () => {
    const s = "x".repeat(120);
    expect(truncateForAudit(s, 20)!.length).toBeLessThanOrEqual(20);
  });

  it("content-only change emits content_changed only when worker gate did not reset approval", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: false,
      approvalReset: false,
      materialChanged: true,
      previousApprovalStatus: "approved",
      nextApprovalStatus: "approved",
      actor,
      fieldDelta: baseFieldDelta({
        content: { changed: true, prevLength: 2, nextLength: 4 },
      }),
    });
    expect(rows.map((r) => r.action)).toEqual(["content_changed"]);
  });

  it("material edit with approval reset emits field rows then approval_reset_after_edit", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: false,
      approvalReset: true,
      materialChanged: true,
      previousApprovalStatus: "approved",
      nextApprovalStatus: "pending_approval",
      actor,
      fieldDelta: baseFieldDelta({
        content: { changed: true, prevLength: 1, nextLength: 3 },
        schedule: { changed: true, prevIso: "2026-01-01T00:00:00.000Z", nextIso: "2026-02-01T00:00:00.000Z" },
      }),
    });
    expect(rows.map((r) => r.action)).toEqual([
      "content_changed",
      "schedule_changed",
      "approval_reset_after_edit",
    ]);
    const reset = rows.find((r) => r.action === "approval_reset_after_edit");
    expect(reset?.details.changedFields).toEqual(["content", "schedule"]);
  });

  it("resubmit emits resubmitted_for_approval and skips approval_reset_after_edit even if approvalReset", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: true,
      approvalReset: true,
      materialChanged: false,
      previousApprovalStatus: "rejected",
      nextApprovalStatus: "pending_approval",
      actor,
      fieldDelta: baseFieldDelta(),
    });
    expect(rows.map((r) => r.action)).toEqual(["resubmitted_for_approval"]);
  });

  it("resubmit plus content edit emits content_changed then resubmitted_for_approval", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: true,
      approvalReset: true,
      materialChanged: true,
      previousApprovalStatus: "rejected",
      nextApprovalStatus: "pending_approval",
      actor,
      fieldDelta: baseFieldDelta({
        content: { changed: true, prevLength: 2, nextLength: 10 },
      }),
    });
    expect(rows.map((r) => r.action)).toEqual(["content_changed", "resubmitted_for_approval"]);
    const resub = rows.find((r) => r.action === "resubmitted_for_approval");
    expect(resub?.details.changedFields).toEqual(["content"]);
  });

  it("link and account changes emit separate actions", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: false,
      approvalReset: false,
      materialChanged: false,
      previousApprovalStatus: "pending_approval",
      nextApprovalStatus: "pending_approval",
      actor,
      fieldDelta: baseFieldDelta({
        link: {
          changed: true,
          prevTruncated: "https://a.com",
          nextTruncated: "https://b.com",
        },
        account: { changed: true, prevAccountId: "a1", nextAccountId: "a2" },
      }),
    });
    expect(rows.map((r) => r.action)).toEqual(["link_changed", "account_changed"]);
  });

  it("no field change and no resubmit yields empty plan", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: false,
      approvalReset: false,
      materialChanged: false,
      previousApprovalStatus: "approved",
      nextApprovalStatus: "approved",
      actor,
      fieldDelta: baseFieldDelta(),
    });
    expect(rows).toHaveLength(0);
  });

  it("approval reset without materialChanged does not emit reset row", () => {
    const rows = planSocialPostPatchAuditRows({
      postId: "p1",
      campaignId: "c1",
      provider: "linkedin",
      resubmitForApproval: false,
      approvalReset: true,
      materialChanged: false,
      previousApprovalStatus: "approved",
      nextApprovalStatus: "approved",
      actor,
      fieldDelta: baseFieldDelta(),
    });
    expect(rows).toHaveLength(0);
  });
});
