/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { BroadcastUpcomingEventsCard } from "./BroadcastUpcomingEventsCard";

describe("BroadcastUpcomingEventsCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders empty state", async () => {
    await act(async () => {
      root.render(
        <BroadcastUpcomingEventsCard
          events={[]}
          busyEventId={null}
          launchDisabled={false}
          onPrepareLaunch={() => {}}
          onLaunch={() => {}}
        />
      );
    });
    expect(container.querySelector('[data-testid="broadcast-upcoming-empty"]')).toBeTruthy();
  });

  it("renders event rows", async () => {
    await act(async () => {
      root.render(
        <BroadcastUpcomingEventsCard
          events={[
            {
              id: 22,
              title: "Keynote",
              scheduledStartIso: "2026-08-01T16:00:00.000Z",
              status: "scheduled",
              roomId: "r1",
              scenePresetId: null,
              defaultTimelineTemplateId: 5,
            },
          ]}
          busyEventId={null}
          launchDisabled={false}
          onPrepareLaunch={() => {}}
          onLaunch={() => {}}
        />
      );
    });
    expect(container.querySelector('[data-testid="broadcast-upcoming-row-22"]')).toBeTruthy();
    expect(container.textContent).toContain("Keynote");
  });
});
