import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TELEMETRY_EVENT_TYPES,
  buildNewAccountEventPayload,
  buildOnboardingCompletedEventPayload,
  emitNewAccountEvent,
  emitOnboardingCompletedEvent,
} from "@/lib/telemetry/telemetry-events";

describe("STEP 1 telemetry event types", () => {
  it("surfaces the three telemetry event types", () => {
    assert.deepEqual([...TELEMETRY_EVENT_TYPES], [
      "new_account",
      "onboarding_completed",
      "asset_purchased",
    ]);
  });
});

describe("buildNewAccountEventPayload", () => {
  it("carries only the account id, approval state, and timestamp", () => {
    const payload = buildNewAccountEventPayload(42, false, "2026-11-01T17:00:00.000Z");
    assert.deepEqual(payload, {
      accountId: 42,
      isApproved: false,
      registeredAt: "2026-11-01T17:00:00.000Z",
    });
    assert.equal("phone" in payload, false);
    assert.equal("email" in payload, false);
    assert.equal("passwordHash" in payload, false);
  });
});

describe("buildOnboardingCompletedEventPayload", () => {
  it("carries only the onboarding id and completion state", () => {
    const payload = buildOnboardingCompletedEventPayload(7, "submitted");
    assert.deepEqual(payload, { onboardingId: 7, onboardingStatus: "submitted" });
    assert.equal("phone" in payload, false);
  });
});

describe("emitNewAccountEvent", () => {
  it("emits new_account with the payload and the new user's id", async () => {
    const calls: Array<{ event: string; payload: unknown; userId?: number }> = [];
    const fakeEmit = async (event: string, payload: unknown, userId?: number) => {
      calls.push({ event, payload, userId });
    };
    await emitNewAccountEvent(
      fakeEmit as never,
      42,
      42,
      "2026-11-01T17:00:00.000Z",
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].event, "new_account");
    assert.deepEqual(calls[0].payload, {
      accountId: 42,
      isApproved: false,
      registeredAt: "2026-11-01T17:00:00.000Z",
    });
    assert.equal(calls[0].userId, 42);
  });
});

describe("emitOnboardingCompletedEvent", () => {
  it("emits onboarding_completed with the payload and the user's id", async () => {
    const calls: Array<{ event: string; payload: unknown; userId?: number }> = [];
    const fakeEmit = async (event: string, payload: unknown, userId?: number) => {
      calls.push({ event, payload, userId });
    };
    await emitOnboardingCompletedEvent(fakeEmit as never, 7, "submitted", 99);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].event, "onboarding_completed");
    assert.deepEqual(calls[0].payload, {
      onboardingId: 7,
      onboardingStatus: "submitted",
    });
    assert.equal(calls[0].userId, 99);
  });
});
