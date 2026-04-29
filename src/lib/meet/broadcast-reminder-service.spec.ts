/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { buildReminderItemsForUpcomingEvents } from "./broadcast-reminder-service";
import type { BroadcastEvent } from "./broadcast-events";

jest.mock("./broadcast-event-store", () => ({
  listUpcomingBroadcastEvents: jest.fn(),
}));

jest.mock("./broadcast-launch-readiness-store", () => ({
  getBroadcastLaunchReadinessReportForEvent: jest.fn(),
}));

import { listUpcomingBroadcastEvents } from "./broadcast-event-store";
import { getBroadcastLaunchReadinessReportForEvent } from "./broadcast-launch-readiness-store";

function ev(start: string, id = 1): BroadcastEvent {
  return {
    id,
    userId: 1,
    title: "T",
    description: null,
    scheduledStartIso: start,
    scheduledEndIso: null,
    timezone: null,
    roomId: "r",
    status: "scheduled",
    scenePresetId: null,
    defaultTimelineTemplateId: null,
    showPackageId: null,
    createdAtIso: "2026-01-01T00:00:00.000Z",
    updatedAtIso: "2026-01-01T00:00:00.000Z",
  };
}

describe("broadcast-reminder-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("emits 30m bucket reminder", async () => {
    (listUpcomingBroadcastEvents as jest.Mock).mockResolvedValueOnce([ev("2026-04-10T13:25:00.000Z")]);
    (getBroadcastLaunchReadinessReportForEvent as jest.Mock).mockResolvedValue({
      broadcastEventId: 1,
      overallStatus: "ready",
      checks: [],
      computedAtIso: "2026-04-10T12:55:00.000Z",
    });
    const items = await buildReminderItemsForUpcomingEvents(1, "2026-04-10T12:55:00.000Z", { horizonHours: 24 });
    expect(items.some((i) => i.reminderType === "event_starting_30m")).toBe(true);
  });

  it("emits readiness_blocked when report blocked", async () => {
    (listUpcomingBroadcastEvents as jest.Mock).mockResolvedValueOnce([ev("2026-04-10T14:00:00.000Z")]);
    (getBroadcastLaunchReadinessReportForEvent as jest.Mock).mockResolvedValue({
      broadcastEventId: 1,
      overallStatus: "blocked",
      checks: [],
      computedAtIso: "2026-04-10T12:55:00.000Z",
    });
    const items = await buildReminderItemsForUpcomingEvents(1, "2026-04-10T12:55:00.000Z", { horizonHours: 24 });
    expect(items.some((i) => i.reminderType === "readiness_blocked")).toBe(true);
  });
});
