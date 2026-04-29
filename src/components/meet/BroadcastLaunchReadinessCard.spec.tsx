/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "@jest/globals";
import { BroadcastLaunchReadinessCard } from "./BroadcastLaunchReadinessCard";
import type { BroadcastLaunchReadinessReport } from "@/lib/meet/broadcast-launch-readiness";

describe("BroadcastLaunchReadinessCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders blocked state", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const report: BroadcastLaunchReadinessReport = {
      broadcastEventId: 1,
      overallStatus: "blocked",
      checks: [{ key: "room_assigned", status: "blocked", summary: "No room" }],
      computedAtIso: "2026-01-01T00:00:00.000Z",
    };
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(<BroadcastLaunchReadinessCard report={report} />);
    });
    expect(el.querySelector('[data-testid="broadcast-launch-readiness-card"]')?.textContent).toContain("blocked");
  });
});
