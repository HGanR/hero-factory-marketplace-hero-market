/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildCountdownRenderPayload,
  getDefaultBroadcastScheduleState,
  getDueScheduledActions,
  getPendingScheduledActions,
  mergeBroadcastSchedulePatch,
  validateBroadcastScheduleState,
  MAX_SCHEDULED_ACTIONS,
} from "./broadcast-schedule";

describe("broadcast-schedule", () => {
  const base = () => getDefaultBroadcastScheduleState(1, 10);

  it("validateBroadcastScheduleState accepts minimal valid state", () => {
    const s = base();
    const v = validateBroadcastScheduleState(s);
    expect(v.ok).toBe(true);
  });

  it("validateBroadcastScheduleState rejects duplicate action ids", () => {
    const s = base();
    const dup = {
      ...s,
      actions: [
        {
          id: "x",
          actionType: "stop_countdown" as const,
          executeAtIso: new Date().toISOString(),
          payload: {},
          enabled: true,
        },
        {
          id: "x",
          actionType: "stop_countdown" as const,
          executeAtIso: new Date(Date.now() + 60_000).toISOString(),
          payload: {},
          enabled: true,
        },
      ],
    };
    const v = validateBroadcastScheduleState(dup);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("validateBroadcastScheduleState rejects too many actions", () => {
    const s = base();
    const actions = Array.from({ length: MAX_SCHEDULED_ACTIONS + 1 }, (_, i) => ({
      id: `a${i}`,
      actionType: "stop_countdown" as const,
      executeAtIso: new Date(Date.now() + i * 1000).toISOString(),
      payload: {},
      enabled: true,
    }));
    const v = validateBroadcastScheduleState({ ...s, actions });
    expect(v.ok).toBe(false);
  });

  it("getDueScheduledActions returns enabled non-executed actions at or before now", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const s = {
      ...base(),
      actions: [
        {
          id: "due",
          actionType: "stop_countdown" as const,
          executeAtIso: past,
          payload: {},
          enabled: true,
        },
        {
          id: "later",
          actionType: "stop_countdown" as const,
          executeAtIso: future,
          payload: {},
          enabled: true,
        },
        {
          id: "done",
          actionType: "stop_countdown" as const,
          executeAtIso: past,
          payload: {},
          enabled: true,
          executedAtIso: past,
        },
      ],
    };
    const now = new Date().toISOString();
    const due = getDueScheduledActions(s, now);
    expect(due.map((a) => a.id)).toEqual(["due"]);
    const pending = getPendingScheduledActions(s, now);
    expect(pending.map((a) => a.id)).toEqual(["later"]);
  });

  it("mergeBroadcastSchedulePatch merges countdown partial", () => {
    const s = base();
    const m = mergeBroadcastSchedulePatch(s, { countdown: { visible: true, label: "Go" } });
    expect(m.countdown.visible).toBe(true);
    expect(m.countdown.label).toBe("Go");
  });

  it("buildCountdownRenderPayload returns null when not visible", () => {
    const p = buildCountdownRenderPayload({ visible: false, position: "top_right" }, new Date().toISOString());
    expect(p).toBeNull();
  });

  it("buildCountdownRenderPayload shows 00:00 after target passed", () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const p = buildCountdownRenderPayload(
      { visible: true, targetTimeIso: past, position: "top_right" },
      new Date().toISOString()
    );
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.displayTime).toBe("00:00");
    expect(p.targetPassed).toBe(true);
  });
});
