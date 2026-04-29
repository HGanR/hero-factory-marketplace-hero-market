import {
  confirmPublishWorkflowSchedule,
  confirmPublishWorkflowScheduleNonConflicting,
} from "@/lib/revenue-os/confirm-publish-workflow-schedule";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

const baseRow = (over: Partial<RevenueOsPublishWorkflowRow>): RevenueOsPublishWorkflowRow => ({
  postId: "p1",
  platform: "instagram",
  bodyPreview: "x",
  status: "draft",
  ...over,
});

describe("confirm-publish-workflow-schedule", () => {
  it("applies suggested time when no actual scheduledAt", () => {
    const r = confirmPublishWorkflowSchedule({
      rows: [
        baseRow({
          postId: "a",
          suggestedScheduledAt: "2025-04-01T14:00:00.000Z",
          actualScheduledAt: null,
        }),
      ],
      confirmOverwrite: false,
    });
    expect(r.patches).toHaveLength(1);
    expect(r.appliedCount).toBe(1);
    expect(r.patches[0]?.scheduledAtIso).toContain("2025-04-01");
  });

  it("skips blocking conflicts", () => {
    const r = confirmPublishWorkflowSchedule({
      rows: [
        baseRow({
          suggestedScheduledAt: "2025-04-01T14:00:00.000Z",
          hasConflict: true,
          conflictSeverity: "blocking",
        }),
      ],
      confirmOverwrite: false,
    });
    expect(r.patches).toHaveLength(0);
    expect(r.conflictCount).toBe(1);
  });

  it("bulk accept non-conflicting applies only rows without conflicts", () => {
    const r = confirmPublishWorkflowScheduleNonConflicting({
      rows: [
        baseRow({
          postId: "ok",
          suggestedScheduledAt: "2025-04-01T14:00:00.000Z",
          actualScheduledAt: null,
        }),
        baseRow({
          postId: "bad",
          suggestedScheduledAt: "2025-04-02T14:00:00.000Z",
          hasConflict: true,
          conflictSeverity: "advisory",
        }),
      ],
      confirmOverwrite: false,
    });
    expect(r.patches).toHaveLength(1);
    expect(r.patches[0]?.postId).toBe("ok");
  });

  it("overwrite protection when actual differs", () => {
    const r = confirmPublishWorkflowSchedule({
      rows: [
        baseRow({
          suggestedScheduledAt: "2025-04-01T14:00:00.000Z",
          actualScheduledAt: "2025-05-01T10:00:00.000Z",
        }),
      ],
      confirmOverwrite: false,
    });
    expect(r.patches).toHaveLength(0);
    expect(r.skipped.some((s) => /overwrite/i.test(s.reason))).toBe(true);
  });

  it("allows overwrite when confirmOverwrite true", () => {
    const r = confirmPublishWorkflowSchedule({
      rows: [
        baseRow({
          suggestedScheduledAt: "2025-04-01T14:00:00.000Z",
          actualScheduledAt: "2025-05-01T10:00:00.000Z",
        }),
      ],
      confirmOverwrite: true,
    });
    expect(r.patches).toHaveLength(1);
  });
});
