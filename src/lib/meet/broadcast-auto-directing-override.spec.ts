/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDefaultBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";
import { isManualAutoDirectingOverrideActive } from "@/lib/meet/broadcast-auto-directing-override";

jest.mock("@/lib/meet/broadcast-auto-directing-store", () => ({
  ensureBroadcastAutoDirectingStateForSession: jest.fn(),
  upsertBroadcastAutoDirectingState: jest.fn(async () => {}),
}));

jest.mock("@/lib/meet/broadcast-metrics", () => ({
  incrementBroadcastAutoDirectingPauseManualOverride: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-audit", () => ({
  broadcastAudit: jest.fn(),
}));

import { ensureBroadcastAutoDirectingStateForSession, upsertBroadcastAutoDirectingState } from "@/lib/meet/broadcast-auto-directing-store";
import { incrementBroadcastAutoDirectingPauseManualOverride } from "@/lib/meet/broadcast-metrics";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { recordOperatorManualLayoutOverride } from "@/lib/meet/broadcast-auto-directing-override";

describe("broadcast-auto-directing-override", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recordOperatorManualLayoutOverride sets future manualOverrideUntilIso and metrics", async () => {
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    (ensureBroadcastAutoDirectingStateForSession as jest.Mock).mockResolvedValue({
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: 5,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });

    await recordOperatorManualLayoutOverride(77, 5, "room-z");

    expect(upsertBroadcastAutoDirectingState).toHaveBeenCalled();
    const arg = (upsertBroadcastAutoDirectingState as jest.Mock).mock.calls[0][0] as {
      state: { manualOverrideUntilIso: string | null };
    };
    expect(arg.state.manualOverrideUntilIso).toBeTruthy();
    const now = new Date().toISOString();
    expect(isManualAutoDirectingOverrideActive(arg.state.manualOverrideUntilIso, now)).toBe(true);
    expect(incrementBroadcastAutoDirectingPauseManualOverride).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5, roomId: "room-z", sessionId: 77, reason: "layout" })
    );
    expect(broadcastAudit).toHaveBeenCalledWith(
      "broadcast_auto_directing_manual_override",
      expect.objectContaining({ broadcastSessionId: 77, userId: 5, roomId: "room-z" })
    );
  });

  it("recordOperatorManualLayoutOverride swallows store errors", async () => {
    (ensureBroadcastAutoDirectingStateForSession as jest.Mock).mockRejectedValue(new Error("db down"));
    await expect(recordOperatorManualLayoutOverride(1, 1, "r")).resolves.toBeUndefined();
    expect(incrementBroadcastAutoDirectingPauseManualOverride).not.toHaveBeenCalled();
  });
});
