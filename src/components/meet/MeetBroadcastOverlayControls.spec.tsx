/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { MeetBroadcastOverlayControls } from "./MeetBroadcastOverlayControls";

describe("MeetBroadcastOverlayControls", () => {
  let container: HTMLDivElement;
  let root: Root;
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.fetch = jest.fn(async (url: string | URL) => {
      const u = String(url);
      const emptyOk = { ok: true, status: 200, json: async () => ({ ok: true, packs: [] }) };
      if (u.includes("/overlay-packs")) return emptyOk;
      if (u.includes("/guest-card-packs")) return emptyOk;
      return { ok: false, status: 404, json: async () => ({}) };
    }) as typeof fetch;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = origFetch;
  });

  const noop = async () => ({ ok: true as const });

  it("shows V2-only notice when template inactive", () => {
    act(() => {
      root.render(
        <MeetBroadcastOverlayControls
          broadcastSessionId={1}
          hostWalletAddress="0x"
          templateActive={false}
          overlaySummary={null}
          fetchOverlayState={noop}
          updateOverlayState={async () => ({ ok: true })}
          resetOverlayState={async () => ({ ok: true })}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-overlay-disabled"]')).toBeTruthy();
  });

  it("renders controls when V2 template active", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastOverlayControls
          broadcastSessionId={1}
          hostWalletAddress="0x"
          templateActive
          overlaySummary={{
            lowerThirdVisible: false,
            tickerVisible: false,
            ctaBannerVisible: false,
            updatedAt: null,
          }}
          fetchOverlayState={noop}
          updateOverlayState={async () => ({ ok: true })}
          resetOverlayState={async () => ({ ok: true })}
        />
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(container.querySelector('[data-testid="meet-broadcast-overlay-controls"]')).toBeTruthy();
  });
});
