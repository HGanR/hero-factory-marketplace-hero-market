/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { BroadcastAnalyticsDashboard } from "./BroadcastAnalyticsDashboard";

describe("BroadcastAnalyticsDashboard", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = jest.fn();

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    jest.resetAllMocks();
  });

  it("loads dashboard when expanded", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        summary: {
          totalSessions: 1,
          liveSessions: 0,
          completedSessions: 1,
          averageDurationSeconds: 10,
          totalDestinationsUsed: 1,
          totalFailedDestinations: 0,
          degradedSessionCount: 0,
          v2SessionCount: 0,
          v2FallbackCount: 0,
          autoDirectingApplyCount: 0,
          scheduleActionCount: 0,
          overlayChangeCount: 0,
          liveSceneChangeCount: 0,
          broadcastEventLinkedCount: 0,
          calendarLinkedCount: 0,
        },
        breakdowns: {
          sessionsByDay: [],
          sessionsByCompositorMode: {},
          sessionsByFinalStatus: {},
          destinationFailuresByPlatform: {},
          eventLinkedVsManual: { linked: 0, manual: 1 },
          calendarLinkedVsUnlinked: { linked: 0, unlinked: 1 },
          autoDirectingModeUsage: {},
          timelineTemplateUsage: {},
          averageDurationByCompositorMode: {},
        },
        filtersApplied: { dateRange: "last_30_days", fromIso: "a", toIso: "b" },
        generatedAt: "2026-04-01T00:00:00.000Z",
        sessionsTruncated: false,
        sessionSampleSize: 1,
        recentSessions: [],
      }),
    });

    await act(async () => {
      root.render(<BroadcastAnalyticsDashboard hostWalletAddress="0xabc" />);
    });

    const btn = container.querySelector("button");
    expect(btn?.textContent).toContain("Cross-session analytics dashboard");

    await act(async () => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.querySelector('[data-testid="broadcast-analytics-summary-grid"]')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalled();
  });
});
