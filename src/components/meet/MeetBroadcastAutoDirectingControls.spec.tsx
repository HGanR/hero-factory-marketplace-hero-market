/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { MeetBroadcastAutoDirectingControls } from "./MeetBroadcastAutoDirectingControls";

describe("MeetBroadcastAutoDirectingControls", () => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).confirm;
  });

  it("shows unavailable copy when template not active", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastAutoDirectingControls
          broadcastSessionId={1}
          hostWalletAddress="0xabc"
          templateActive={false}
          summaryFromStatus={null}
          fetchAutoDirectingState={jest.fn(async () => ({ ok: true, data: {} }))}
          updateAutoDirectingState={jest.fn(async () => ({ ok: true }))}
          resetAutoDirectingState={jest.fn(async () => ({ ok: true }))}
        />
      );
    });
    expect(container.textContent).toMatch(/available only for active V2/i);
    expect(container.querySelector('[data-testid="meet-broadcast-auto-directing-controls"]')).toBeNull();
  });

  it("renders mode controls and applies resume / apply actions", async () => {
    const updateAutoDirectingState = jest
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    const fetchAutoDirectingState = jest.fn(async () => ({
      ok: true,
      data: { policy: { mode: "off", preferScreenShareFocus: true, preferPortraitLayouts: true, speakerSwitchDebounceMs: 4500, galleryParticipantThreshold: 3, allowAutoReturnToProgramDefault: false } },
    }));

    await act(async () => {
      root.render(
        <MeetBroadcastAutoDirectingControls
          broadcastSessionId={9}
          hostWalletAddress="0xabc"
          templateActive
          summaryFromStatus={{
            mode: "suggest_only",
            latestRecommendedLayout: "speaker",
            latestReason: "r",
            latestConfidence: "medium",
            manualOverrideActive: true,
            lastAppliedAt: null,
          }}
          fetchAutoDirectingState={fetchAutoDirectingState}
          updateAutoDirectingState={updateAutoDirectingState}
          resetAutoDirectingState={jest.fn(async () => ({ ok: true }))}
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const resume = [...container.querySelectorAll("button")].find((b) => /Resume auto-directing/i.test(b.textContent ?? ""));
    expect(resume).toBeTruthy();
    await act(async () => {
      resume!.click();
    });
    expect(updateAutoDirectingState).toHaveBeenCalledWith(9, { manualOverrideUntilIso: null });

    const apply = [...container.querySelectorAll("button")].find((b) =>
      /Apply recommended layout now/i.test(b.textContent ?? "")
    );
    expect(apply).toBeTruthy();
    await act(async () => {
      apply!.click();
    });
    expect(updateAutoDirectingState).toHaveBeenCalledWith(9, { applyRecommendedNow: true });
  });

  it("reset settings calls reset when confirm accepts", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).confirm = () => true;
    const resetAutoDirectingState = jest.fn(async () => ({ ok: true }));
    const fetchAutoDirectingState = jest.fn(async () => ({
      ok: true,
      data: {
        policy: {
          mode: "off",
          preferScreenShareFocus: true,
          preferPortraitLayouts: true,
          speakerSwitchDebounceMs: 4500,
          galleryParticipantThreshold: 3,
          allowAutoReturnToProgramDefault: false,
        },
      },
    }));

    await act(async () => {
      root.render(
        <MeetBroadcastAutoDirectingControls
          broadcastSessionId={3}
          hostWalletAddress=""
          templateActive
          summaryFromStatus={null}
          fetchAutoDirectingState={fetchAutoDirectingState}
          updateAutoDirectingState={jest.fn(async () => ({ ok: true }))}
          resetAutoDirectingState={resetAutoDirectingState}
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const resetBtn = [...container.querySelectorAll("button")].find((b) => /Reset settings/i.test(b.textContent ?? ""));
    expect(resetBtn).toBeTruthy();
    await act(async () => {
      resetBtn!.click();
    });
    expect(resetAutoDirectingState).toHaveBeenCalledWith(3);
  });
});
