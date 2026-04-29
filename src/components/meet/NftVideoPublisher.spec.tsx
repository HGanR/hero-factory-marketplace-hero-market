/**
 * @jest-environment jsdom
 */

jest.mock("@livekit/components-styles", () => ({}));

/** Avoid loading livekit-client UMD in Jest (pulls jose / TextEncoder paths). Real app uses full SDK. */
jest.mock("livekit-client", () => ({
  Track: {
    Source: {
      Camera: "camera",
      ScreenShare: "screen_share",
      Microphone: "microphone",
      Unknown: "unknown",
    },
  },
}));

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, afterAll, jest, beforeAll } from "@jest/globals";
import { Track } from "livekit-client";
import { NftVideoPublisher } from "./NftVideoPublisher";

const DATA_URL_1PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const mockPublishTrack = jest.fn().mockResolvedValue(undefined);
const mockUnpublishTrack = jest.fn().mockResolvedValue(undefined);

jest.mock("@livekit/components-react", () => ({
  useRoomContext: jest.fn(() => ({
    localParticipant: {
      publishTrack: mockPublishTrack,
      unpublishTrack: mockUnpublishTrack,
    },
  })),
}));

class SuccessImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  naturalWidth = 100;
  naturalHeight = 100;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("NftVideoPublisher", () => {
  let container: HTMLDivElement;
  let root: Root;
  const OriginalImage = global.Image;

  const origGetContext = HTMLCanvasElement.prototype.getContext;

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillStyle: "",
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    if (!HTMLCanvasElement.prototype.captureStream) {
      HTMLCanvasElement.prototype.captureStream = jest.fn(function captureStreamMock(this: HTMLCanvasElement) {
        const track = {
          stop: jest.fn(),
          kind: "video",
          id: "mock-canvas-vt",
        } as unknown as MediaStreamTrack;
        return { getVideoTracks: () => [track] } as MediaStream;
      });
    }
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Image = SuccessImage as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    global.Image = OriginalImage;
    act(() => root.unmount());
    container.remove();
  });

  it("publishes NFT canvas track with Track.Source.Camera for the grid pipeline", async () => {
    await act(async () => {
      root.render(<NftVideoPublisher imageUrl={DATA_URL_1PX} />);
    });

    await act(async () => {
      await new Promise((r) => queueMicrotask(r));
    });

    expect(mockPublishTrack).toHaveBeenCalledTimes(1);
    expect(mockPublishTrack).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "nft-avatar",
        source: Track.Source.Camera,
      })
    );
  });

  it("logs when publishTrack rejects", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockPublishTrack.mockRejectedValueOnce(new Error("publish denied"));

    await act(async () => {
      root.render(<NftVideoPublisher imageUrl={DATA_URL_1PX} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[meet nft avatar\].*publishTrack failed/i),
      expect.any(Error)
    );
    warnSpy.mockRestore();
    mockPublishTrack.mockResolvedValue(undefined);
  });

  it("logs when image fails to load", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Image = FailingImage as any;

    try {
      await act(async () => {
        root.render(<NftVideoPublisher imageUrl="https://example.com/broken.png" />);
      });
      await act(async () => {
        await new Promise((r) => queueMicrotask(r));
      });
    } finally {
      global.Image = OriginalImage;
    }

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/\[meet nft avatar\].*Image failed to load/i));
    warnSpy.mockRestore();
  });

  it("unpublishes when imageUrl changes before publishing again", async () => {
    const prevCapture = HTMLCanvasElement.prototype.captureStream;
    let vid = 0;
    HTMLCanvasElement.prototype.captureStream = jest.fn(() => ({
      getVideoTracks: () =>
        [
          {
            id: `vt-${++vid}`,
            stop: jest.fn(),
            kind: "video",
          },
        ] as unknown as MediaStreamTrack[],
    })) as unknown as typeof HTMLCanvasElement.prototype.captureStream;

    try {
      const urlA = `${DATA_URL_1PX}#a`;
      const urlB = `${DATA_URL_1PX}#b`;

      await act(async () => {
        root.render(<NftVideoPublisher imageUrl={urlA} />);
      });
      await act(async () => {
        await new Promise((r) => queueMicrotask(r));
      });

      await act(async () => {
        root.render(<NftVideoPublisher imageUrl={urlB} />);
      });
      await act(async () => {
        await new Promise((r) => queueMicrotask(r));
      });

      expect(mockUnpublishTrack).toHaveBeenCalled();
      expect(mockPublishTrack).toHaveBeenCalledTimes(2);
    } finally {
      HTMLCanvasElement.prototype.captureStream = prevCapture;
    }
  });
});
