/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  canPullFromExternalCalendar,
  canPushToExternalCalendar,
  validateBroadcastCalendarLink,
  summarizeCalendarLink,
} from "./broadcast-calendar-sync";

describe("broadcast-calendar-sync", () => {
  it("validateBroadcastCalendarLink accepts google link", () => {
    const v = validateBroadcastCalendarLink({
      provider: "google_calendar",
      syncMode: "linked_readonly",
      externalEventId: "abc",
      broadcastEventId: 1,
    });
    expect(v.ok).toBe(true);
  });

  it("validateBroadcastCalendarLink rejects manual without url", () => {
    const v = validateBroadcastCalendarLink({
      provider: "manual_external",
      syncMode: "linked_readonly",
      broadcastEventId: 1,
    });
    expect(v.ok).toBe(false);
  });

  it("pull/push flags by mode", () => {
    expect(canPullFromExternalCalendar("export_only")).toBe(false);
    expect(canPushToExternalCalendar("export_only")).toBe(true);
    expect(canPullFromExternalCalendar("linked_readonly")).toBe(true);
    expect(canPushToExternalCalendar("linked_bidirectional_prepare")).toBe(true);
  });

  it("summarizeCalendarLink", () => {
    const s = summarizeCalendarLink({
      provider: "google_calendar",
      syncMode: "import_only",
      externalEventUrl: "https://example.com",
      externalCalendarId: "primary",
      externalEventId: "x",
      lastSyncedAt: null,
    });
    expect(s).toContain("google");
  });
});
