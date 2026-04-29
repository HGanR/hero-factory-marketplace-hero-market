/**
 * @jest-environment jsdom
 */

jest.mock("@livekit/components-styles", () => ({}));

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { MeetLiveKitCameraSync } from "./MeetLiveKitCameraSync";

const mockSetCameraEnabled = jest.fn().mockResolvedValue(undefined);

jest.mock("@livekit/components-react", () => ({
  useRoomContext: jest.fn(() => ({
    localParticipant: {
      setCameraEnabled: mockSetCameraEnabled,
    },
  })),
}));

describe("MeetLiveKitCameraSync", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("calls setCameraEnabled(true) when camera is allowed", async () => {
    await act(async () => {
      root.render(<MeetLiveKitCameraSync cameraAllowed />);
    });
    expect(mockSetCameraEnabled).toHaveBeenCalledWith(true);
  });

  it("calls setCameraEnabled(false) when camera is not allowed (NFT / video off)", async () => {
    await act(async () => {
      root.render(<MeetLiveKitCameraSync cameraAllowed={false} />);
    });
    expect(mockSetCameraEnabled).toHaveBeenCalledWith(false);
  });

  it("re-syncs when cameraAllowed toggles", async () => {
    await act(async () => {
      root.render(<MeetLiveKitCameraSync cameraAllowed />);
    });
    expect(mockSetCameraEnabled).toHaveBeenLastCalledWith(true);

    await act(async () => {
      root.render(<MeetLiveKitCameraSync cameraAllowed={false} />);
    });
    expect(mockSetCameraEnabled).toHaveBeenLastCalledWith(false);
  });
});
