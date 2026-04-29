/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { reconcileBroadcastSessionDecision } from "./broadcast-reconcile";
import { EgressStatus } from "livekit-server-sdk";
import { BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS } from "./broadcast-constants";

describe("broadcast-reconcile", () => {
  it("reconciles when LiveKit reports a terminal status", () => {
    const r = reconcileBroadcastSessionDecision({
      livekitEgressId: "EG_1",
      liveKitStatus: EgressStatus.EGRESS_COMPLETE,
      sessionAgeMs: 5_000,
    });
    expect(r?.reason).toContain("terminal");
  });

  it("does not reconcile missing egress when session is young", () => {
    expect(
      reconcileBroadcastSessionDecision({
        livekitEgressId: "EG_1",
        liveKitStatus: undefined,
        sessionAgeMs: BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS - 1,
      })
    ).toBeNull();
  });

  it("reconciles missing egress when session is old enough", () => {
    expect(
      reconcileBroadcastSessionDecision({
        livekitEgressId: "EG_1",
        liveKitStatus: undefined,
        sessionAgeMs: BROADCAST_EGRESS_RECONCILE_MIN_SESSION_AGE_MS,
      })?.reason
    ).toBe("livekit_egress_absent_reconcile");
  });

  it("does not reconcile empty egress id", () => {
    expect(
      reconcileBroadcastSessionDecision({
        livekitEgressId: "  ",
        liveKitStatus: undefined,
        sessionAgeMs: 999_999,
      })
    ).toBeNull();
  });
});
