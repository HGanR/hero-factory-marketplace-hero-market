import { describe, expect, it } from "@jest/globals";
import { inboxListRowBadges } from "./inbox-list-badges";
import type { ThreadWithPreview } from "./upsert-social-engagement";

describe("inboxListRowBadges", () => {
  it("returns stable badge keys for list rows", () => {
    const t = {
      id: "t1",
      labelSlugs: ["vip"],
      hasOpenAssignment: true,
      requiresManual: false,
      status: "new",
      intent: "lead",
      urgency: "high",
    } as unknown as ThreadWithPreview;
    const b = inboxListRowBadges(t);
    expect(b.isHighSignal).toBe(true);
    expect(b.hasLabels).toBe(true);
    expect(b.isAssigned).toBe(true);
  });
});
