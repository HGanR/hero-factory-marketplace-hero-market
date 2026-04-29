import { describe, it, expect } from "@jest/globals";
import type { SocialActivityTimelineEntry } from "@/lib/social/social-publish-observability";
import { compactSocialActivityTimelineForDisplay } from "@/lib/social/social-activity-timeline-ui-compact";

function e(partial: Partial<SocialActivityTimelineEntry>): SocialActivityTimelineEntry {
  return {
    kind: "content_changed",
    at: "2026-06-01T12:00:00.000Z",
    label: "Content updated",
    detail: null,
    sourceAuditId: "x",
    rawAction: "content_changed",
    ...partial,
  };
}

describe("social-activity-timeline-ui-compact", () => {
  it("compacts adjacent PATCH kinds within burst window", () => {
    const rows = compactSocialActivityTimelineForDisplay(
      [
        e({ kind: "schedule_changed", at: "2026-06-10T12:00:02.000Z", label: "Schedule changed", rawAction: "schedule_changed" }),
        e({ kind: "content_changed", at: "2026-06-10T12:00:01.000Z", label: "Content updated", rawAction: "content_changed" }),
        e({
          kind: "edit_reset_approval",
          at: "2026-06-10T12:00:00.000Z",
          label: "Approval reset after edit",
          rawAction: "approval_reset_after_edit",
        }),
      ],
      { burstWindowMs: 5000, minBurstSize: 2 }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe("burst");
    if (rows[0].mode === "burst") {
      expect(rows[0].label).toContain("schedule");
      expect(rows[0].label).toContain("content");
      expect(rows[0].label).toContain("approval reset");
    }
  });

  it("does not merge publish_failed with edit events", () => {
    const rows = compactSocialActivityTimelineForDisplay(
      [
        e({ kind: "publish_failed", at: "2026-06-10T12:00:01.000Z", label: "Failed", rawAction: "scheduled_publish_failed" }),
        e({ kind: "content_changed", at: "2026-06-10T12:00:00.000Z", rawAction: "content_changed" }),
      ],
      { burstWindowMs: 5000 }
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.mode === "single")).toBe(true);
  });

  it("does not merge across large time gaps", () => {
    const rows = compactSocialActivityTimelineForDisplay(
      [
        e({ kind: "content_changed", at: "2026-06-10T12:00:00.000Z", rawAction: "content_changed" }),
        e({
          kind: "schedule_changed",
          at: "2026-06-10T11:00:00.000Z",
          label: "Schedule changed",
          rawAction: "schedule_changed",
        }),
      ],
      { burstWindowMs: 2500, minBurstSize: 2 }
    );
    expect(rows).toHaveLength(2);
  });

  it("leaves single PATCH row unmerged", () => {
    const rows = compactSocialActivityTimelineForDisplay(
      [e({ kind: "link_changed", at: "2026-06-10T12:00:00.000Z", label: "Link updated", rawAction: "link_changed" })],
      { minBurstSize: 2 }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe("single");
  });
});
