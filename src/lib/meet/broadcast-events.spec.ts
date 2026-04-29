/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { validateBroadcastEvent, canLaunchBroadcastEvent } from "./broadcast-events";

describe("broadcast-events", () => {
  it("validateBroadcastEvent create requires title and scheduledStartIso", () => {
    const r = validateBroadcastEvent({}, "create");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(" ")).toMatch(/title/);
      expect(r.errors.join(" ")).toMatch(/scheduledStartIso/);
    }
  });

  it("validateBroadcastEvent accepts minimal create payload", () => {
    const r = validateBroadcastEvent(
      { title: "Town hall", scheduledStartIso: "2026-12-01T18:00:00.000Z" },
      "create"
    );
    expect(r.ok).toBe(true);
  });

  it("canLaunchBroadcastEvent rejects without room", () => {
    const r = canLaunchBroadcastEvent(
      {
        status: "scheduled",
        roomId: null,
        scheduledStartIso: "2026-12-01T18:00:00.000Z",
        userId: 1,
      },
      "2026-11-01T00:00:00.000Z"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("event_room_required");
  });
});
