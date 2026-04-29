import {
  applySequenceScheduleToDrafts,
  matchPostsToScheduleSlots,
  postMatchesSlotPlatforms,
} from "@/lib/revenue-os/apply-sequence-schedule-to-drafts";
import type { RevenueOsSuggestedSchedulePlan } from "@/lib/revenue-os/content-sequence-schedule-types";

const plan: RevenueOsSuggestedSchedulePlan = {
  slots: [
    {
      dayIndex: 1,
      role: "attention",
      suggestedScheduledAt: "2025-04-01T14:00:00.000Z",
      preferredPlatforms: ["Instagram"],
      confidence: "high",
      reason: "r1",
    },
    {
      dayIndex: 2,
      role: "authority",
      suggestedScheduledAt: "2025-04-02T14:00:00.000Z",
      preferredPlatforms: ["Linkedin"],
      confidence: "medium",
      reason: "r2",
    },
  ],
  timezoneStrategy: "none",
  summary: "s",
};

const sequence = {
  slots: [
    { dayIndex: 1, role: "attention" as const, preferredPlatforms: ["Instagram"], confidence: "high" as const, reason: "" },
    { dayIndex: 2, role: "authority" as const, preferredPlatforms: ["Linkedin"], confidence: "medium" as const, reason: "" },
  ],
  sequencingStrategy: "",
  summary: "",
};

describe("apply-sequence-schedule-to-drafts", () => {
  it("matches posts to slots by role and platform hints", () => {
    const posts = [
      {
        id: "a",
        platform: "instagram",
        scheduledAt: null,
        utmParams: { bentley_content_role: "attention", bentley_sequence_day_index: "1" },
      },
      {
        id: "b",
        platform: "linkedin",
        scheduledAt: null,
        utmParams: { bentley_content_role: "authority", bentley_sequence_day_index: "2" },
      },
    ];
    const pairs = matchPostsToScheduleSlots(posts, plan, sequence);
    expect(pairs).toHaveLength(2);
    expect(postMatchesSlotPlatforms("instagram", plan.slots[0]!)).toBe(true);
  });

  it("applies set_scheduled_at when empty and confirmSetScheduledAt", () => {
    const posts = [
      {
        id: "a",
        platform: "instagram",
        scheduledAt: null,
        utmParams: { bentley_content_role: "attention" },
      },
    ];
    const r = applySequenceScheduleToDrafts({
      posts,
      schedulePlan: plan,
      batchCalendarSequence: sequence,
      confirmSetScheduledAt: true,
      confirmReplaceScheduledAt: false,
    });
    expect(r.rows[0]?.action).toBe("set_scheduled_at");
    expect(r.rows[0]?.nextScheduledAtIso).toBe("2025-04-01T14:00:00.000Z");
  });

  it("requires replace confirmation when scheduledAt already set", () => {
    const posts = [
      {
        id: "a",
        platform: "instagram",
        scheduledAt: "2025-05-01T10:00:00.000Z",
        utmParams: { bentley_content_role: "attention" },
      },
    ];
    const r = applySequenceScheduleToDrafts({
      posts,
      schedulePlan: plan,
      batchCalendarSequence: sequence,
      confirmSetScheduledAt: true,
      confirmReplaceScheduledAt: false,
    });
    expect(r.rows[0]?.action).toBe("needs_replace_confirm");
    expect(r.overwriteProtectionCount).toBe(1);
  });

  it("merges suggested schedule metadata in guidance-only mode", () => {
    const posts = [
      {
        id: "a",
        platform: "instagram",
        scheduledAt: null,
        utmParams: { bentley_content_role: "attention" },
      },
    ];
    const r = applySequenceScheduleToDrafts({
      posts,
      schedulePlan: plan,
      batchCalendarSequence: sequence,
      guidanceOnly: true,
    });
    expect(r.rows[0]?.action).toBe("utm_suggestion_only");
    expect(r.rows[0]?.mergedUtmParams?.bentley_schedule_role).toBe("attention");
    expect(r.rows[0]?.mergedUtmParams?.bentley_suggested_schedule_at).toBe("2025-04-01T14:00:00.000Z");
  });
});
