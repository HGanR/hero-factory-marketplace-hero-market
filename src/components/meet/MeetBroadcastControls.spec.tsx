/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { MeetBroadcastControls } from "./MeetBroadcastControls";
import { useMeetBroadcast } from "@/hooks/useMeetBroadcast";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

jest.mock("@/hooks/useMeetBroadcast");

const mockUseMeetBroadcast = useMeetBroadcast as jest.MockedFunction<typeof useMeetBroadcast>;

function setPasswordInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function baseMeetBroadcastMock(
  overrides: Partial<ReturnType<typeof useMeetBroadcast>>
): ReturnType<typeof useMeetBroadcast> {
  return {
    destinations: [],
    destinationsEncryptionConfigured: true,
    session: null,
    sessionDestinations: [],
    loading: false,
    error: null,
    errorCode: null,
    setError: jest.fn(),
    setErrorCode: jest.fn(),
    degraded: false,
    timelinePreview: null,
    infoMessage: null,
    setInfoMessage: jest.fn(),
    loadDestinations: jest.fn(),
    refreshStatus: jest.fn().mockResolvedValue(undefined),
    startBroadcast: jest.fn(),
    stopBroadcast: jest.fn().mockResolvedValue(true),
    testDestination: jest.fn(),
    fetchLiveSceneState: jest.fn(),
    updateLiveSceneState: jest.fn(),
    resetLiveSceneState: jest.fn(),
    fetchOverlayState: jest.fn(),
    updateOverlayState: jest.fn(),
    resetOverlayState: jest.fn(),
    fetchScheduleState: jest.fn(),
    updateScheduleState: jest.fn(),
    resetScheduleState: jest.fn(),
    fetchAutoDirectingState: jest.fn(),
    updateAutoDirectingState: jest.fn(),
    resetAutoDirectingState: jest.fn(),
    broadcastRealtimeConnected: false,
    broadcastRealtimeUsePollingFallback: false,
    broadcastRefreshSignal: 0,
    subscribeToBroadcastEvents: jest.fn(),
    unsubscribeFromBroadcastEvents: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useMeetBroadcast>;
}

describe("MeetBroadcastControls ephemeral idempotent notice", () => {
  let container: HTMLDivElement;
  let root: Root;
  let origFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    jest.clearAllMocks();
    origFetch = globalThis.fetch;
    globalThis.fetch = jest.fn((input: RequestInfo) => {
      const u = String(input);
      if (u.includes("/api/meet/broadcast/context")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
    }) as typeof fetch;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (origFetch !== undefined) globalThis.fetch = origFetch;
    else delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  });

  it("shows notice when start returns ephemeralRtmpIgnored with expected reason", async () => {
    const startBroadcast = jest.fn().mockResolvedValue({
      ok: true,
      warnings: [],
      sceneWarnings: [],
      idempotent: true,
      ephemeralRtmpIgnored: true,
      ephemeralRtmpIgnoredReason: BROADCAST_CODES.ephemeralIgnoredIdempotentActiveSession,
      responseCode: BROADCAST_CODES.ok,
      broadcastEventAttachment: null,
      broadcastEventConflict: null,
    });

    mockUseMeetBroadcast.mockReturnValue(baseMeetBroadcastMock({ startBroadcast }));

    await act(async () => {
      root.render(<MeetBroadcastControls roomId="r1" layoutMode="grid" hostWalletAddress="" />);
    });

    const broadcastToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="meet-broadcast-controls"] > button[type="button"]'
    );
    await act(async () => {
      broadcastToggle?.click();
    });

    const keyInput = container.querySelector<HTMLInputElement>('[data-testid="meet-broadcast-ephemeral-stream-key"]');
    expect(keyInput).toBeTruthy();

    await act(async () => {
      setPasswordInputValue(keyInput!, "secret_rtmp_key");
    });

    const startBtn = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Start broadcast")
    );
    expect(startBtn).toBeTruthy();

    await act(async () => {
      startBtn!.click();
      await Promise.resolve();
    });

    expect(startBroadcast).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="meet-broadcast-ephemeral-ignored-idempotent"]')).toBeTruthy();
    expect(container.textContent).toMatch(/already live/i);
    expect(container.textContent).toMatch(/not applied/i);
  });

  it("does not show ephemeral ignored notice on fresh start with ephemeral", async () => {
    const startBroadcast = jest.fn().mockResolvedValue({
      ok: true,
      warnings: [],
      sceneWarnings: [],
      idempotent: false,
      ephemeralRtmpIgnored: false,
      ephemeralRtmpIgnoredReason: null,
      responseCode: BROADCAST_CODES.ok,
      broadcastEventAttachment: null,
      broadcastEventConflict: null,
    });

    mockUseMeetBroadcast.mockReturnValue(baseMeetBroadcastMock({ startBroadcast }));

    await act(async () => {
      root.render(<MeetBroadcastControls roomId="r1" layoutMode="grid" hostWalletAddress="" />);
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="meet-broadcast-controls"] > button[type="button"]')
        ?.click();
    });

    const keyInput = container.querySelector<HTMLInputElement>('[data-testid="meet-broadcast-ephemeral-stream-key"]');
    await act(async () => {
      setPasswordInputValue(keyInput!, "fresh_key");
    });

    const startBtn = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Start broadcast")
    );

    await act(async () => {
      startBtn!.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="meet-broadcast-ephemeral-ignored-idempotent"]')).toBeNull();
  });
});
