/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { MeetBroadcastLiveSceneControls } from "./MeetBroadcastLiveSceneControls";

describe("MeetBroadcastLiveSceneControls", () => {
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
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const noopFetch = async () => ({ ok: true as const });
  const noopUpdate = async () => ({ ok: true as const });
  const noopReset = async () => ({ ok: true as const });

  it("renders disabled notice when template is not active (V1)", () => {
    act(() => {
      root.render(
        <MeetBroadcastLiveSceneControls
          broadcastSessionId={1}
          hostWalletAddress="0xabc"
          templateActive={false}
          liveScene={null}
          fetchLiveSceneState={noopFetch}
          updateLiveSceneState={noopUpdate}
          resetLiveSceneState={noopReset}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-live-scene-disabled"]')).toBeTruthy();
  });

  it("renders controls when V2 template is active", () => {
    act(() => {
      root.render(
        <MeetBroadcastLiveSceneControls
          broadcastSessionId={1}
          hostWalletAddress="0xabc"
          templateActive
          liveScene={{
            sceneType: "program",
            layoutMode: "gallery",
            updatedAt: null,
            updatedByUserId: null,
          }}
          fetchLiveSceneState={noopFetch}
          updateLiveSceneState={noopUpdate}
          resetLiveSceneState={noopReset}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-live-scene-controls"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="broadcast-scene-quick-actions"]')).toBeTruthy();
  });
});
