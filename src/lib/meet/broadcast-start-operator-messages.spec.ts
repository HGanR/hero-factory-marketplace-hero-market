/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { operatorMessagesForBroadcastStartEventAttachment } from "./broadcast-start-operator-messages";
import { BROADCAST_CODES } from "./broadcast-codes";

describe("operatorMessagesForBroadcastStartEventAttachment", () => {
  it("returns attach copy for attached", () => {
    const m = operatorMessagesForBroadcastStartEventAttachment({
      broadcastEventAttachment: "attached",
      responseCode: BROADCAST_CODES.ok,
    });
    expect(m.infoMessage).toMatch(/linked this event/);
    expect(m.errorMessage).toBeNull();
  });

  it("returns already-linked copy", () => {
    const m = operatorMessagesForBroadcastStartEventAttachment({
      broadcastEventAttachment: "already_attached",
      responseCode: BROADCAST_CODES.ok,
    });
    expect(m.infoMessage).toMatch(/already linked/);
  });

  it("returns conflict error when attachment is conflict", () => {
    const m = operatorMessagesForBroadcastStartEventAttachment({
      broadcastEventAttachment: "conflict",
      responseCode: BROADCAST_CODES.broadcastEventIdempotentConflict,
    });
    expect(m.errorMessage).toMatch(/different broadcast event/);
    expect(m.errorCode).toBe(BROADCAST_CODES.broadcastEventIdempotentConflict);
  });
});
