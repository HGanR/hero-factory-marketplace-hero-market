/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { MeetBroadcastTimelinePanel } from "./MeetBroadcastTimelinePanel";

describe("MeetBroadcastTimelinePanel", () => {
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

  it("loads timeline and analytics when expanded", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            events: [
              {
                id: 1,
                eventType: "session_started",
                eventAtIso: "2026-01-01T00:00:00.000Z",
                summary: "Started",
              },
            ],
            summary: { totalEvents: 1, countsByType: {}, firstEventAtIso: null, lastEventAtIso: null },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            analytics: {
              sessionId: 9,
              roomId: "r1",
              startedAt: null,
              endedAt: null,
              durationSeconds: null,
              destinationCount: 1,
              failedDestinationCount: 0,
              liveSceneChangeCount: 0,
              overlayChangeCount: 0,
              scheduleActionCount: 0,
              autoDirectingDecisionCount: 0,
              autoDirectingApplyCount: 0,
              compositorMode: "v1_livekit_default",
              compositorFallbackFromV2: false,
              broadcastEventTitle: null,
            timelineTemplateName: null,
            finalStatus: "active",
            timelineEventCount: 1,
            calendarLink: null,
          },
        }),
      } as Response);

    await act(async () => {
      root.render(<MeetBroadcastTimelinePanel broadcastSessionId={9} hostWalletAddress="" />);
    });

    const btn = container.querySelector("button");
    expect(btn).toBeTruthy();

    await act(async () => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.querySelector('[data-testid="broadcast-analytics-summary-card"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="broadcast-timeline-event-list"]')).toBeTruthy();
    expect(container.textContent).toContain("Started");
  });
});
