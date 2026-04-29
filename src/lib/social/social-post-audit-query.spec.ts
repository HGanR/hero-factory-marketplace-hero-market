/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from "@jest/globals";
import {
  clampSocialPostTimelineLimit,
  isSocialPostTimelineAuditAction,
  listSocialPostTimelineAuditRows,
  SOCIAL_POST_TIMELINE_AUDIT_ACTIONS,
} from "@/lib/social/social-post-audit-query";

describe("social-post-audit-query", () => {
  it("clampSocialPostTimelineLimit enforces max and minimum 1", () => {
    expect(clampSocialPostTimelineLimit(undefined)).toBe(100);
    expect(clampSocialPostTimelineLimit(50)).toBe(50);
    expect(clampSocialPostTimelineLimit(500)).toBe(100);
    expect(clampSocialPostTimelineLimit(0)).toBe(1);
  });

  it("isSocialPostTimelineAuditAction recognizes publish and patch actions", () => {
    expect(isSocialPostTimelineAuditAction("content_changed")).toBe(true);
    expect(isSocialPostTimelineAuditAction("publish_approval_pending")).toBe(true);
    expect(isSocialPostTimelineAuditAction("scheduled_publish_failed")).toBe(true);
    expect(isSocialPostTimelineAuditAction("random_action")).toBe(false);
  });

  it("SOCIAL_POST_TIMELINE_AUDIT_ACTIONS includes edit and worker actions", () => {
    expect(SOCIAL_POST_TIMELINE_AUDIT_ACTIONS).toContain("resubmitted_for_approval");
    expect(SOCIAL_POST_TIMELINE_AUDIT_ACTIONS).toContain("publish");
    expect(SOCIAL_POST_TIMELINE_AUDIT_ACTIONS).toContain("external_review_link_minted");
    expect(SOCIAL_POST_TIMELINE_AUDIT_ACTIONS).toContain("external_review_link_revoked");
    expect(SOCIAL_POST_TIMELINE_AUDIT_ACTIONS).toContain("external_review_link_email_sent");
    expect(SOCIAL_POST_TIMELINE_AUDIT_ACTIONS).toContain("external_review_links_bulk_revoked");
  });

  it("listSocialPostTimelineAuditRows queries postId, allowed actions, desc order, limit", async () => {
    const limit = jest.fn(async () => [
      {
        id: "a",
        action: "content_changed",
        platform: "linkedin",
        details: {},
        createdAt: new Date("2026-06-01T12:00:02.000Z"),
      },
      {
        id: "b",
        action: "schedule_changed",
        platform: "linkedin",
        details: {},
        createdAt: new Date("2026-06-01T12:00:01.000Z"),
      },
    ]);
    const orderBy = jest.fn(() => ({ limit }));
    const where = jest.fn(() => ({ orderBy }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    const db = { select } as unknown as Parameters<typeof listSocialPostTimelineAuditRows>[0];

    const rows = await listSocialPostTimelineAuditRows(db, { postId: "p1", limit: 40 });
    expect(select).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(40);
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("content_changed");
  });
});
