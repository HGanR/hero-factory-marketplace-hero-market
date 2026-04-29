/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { validateBroadcastTimelineTemplate, buildScheduleStateFromTimelineTemplate } from "./broadcast-timeline-template";

describe("broadcast-timeline-template", () => {
  it("validateBroadcastTimelineTemplate rejects missing countdown", () => {
    const r = validateBroadcastTimelineTemplate({ relativeActions: [] });
    expect(r.ok).toBe(false);
  });

  it("buildScheduleStateFromTimelineTemplate builds valid state", () => {
    const tpl = validateBroadcastTimelineTemplate({
      countdown: { visible: true, targetOffsetMsFromEventStart: 0 },
      relativeActions: [],
      automationEnabled: true,
    });
    expect(tpl.ok).toBe(true);
    if (!tpl.ok) return;
    const built = buildScheduleStateFromTimelineTemplate({
      broadcastSessionId: 10,
      userId: 5,
      eventStartIso: "2026-06-15T14:00:00.000Z",
      template: tpl.template,
      nowIso: "2026-06-15T13:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.state.broadcastSessionId).toBe(10);
      expect(built.state.countdown.visible).toBe(true);
    }
  });
});
