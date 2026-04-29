/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { MeetBroadcastScheduleControls } from "./MeetBroadcastScheduleControls";

describe("MeetBroadcastScheduleControls", () => {
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

  it("shows V2-only notice when template is not active", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastScheduleControls
          broadcastSessionId={1}
          hostWalletAddress=""
          templateActive={false}
          scheduleSummary={null}
          fetchScheduleState={jest.fn()}
          updateScheduleState={jest.fn()}
          resetScheduleState={jest.fn()}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-schedule-disabled"]')).toBeTruthy();
  });
});
