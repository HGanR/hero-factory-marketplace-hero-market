/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { BroadcastAutoDirectingPolicyEditor } from "./BroadcastAutoDirectingPolicyEditor";
import { getDefaultBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";

describe("BroadcastAutoDirectingPolicyEditor", () => {
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

  it("invokes onChange when toggling screen-share preference", async () => {
    const onChange = jest.fn();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    await act(async () => {
      root.render(
        <BroadcastAutoDirectingPolicyEditor policy={policy} disabled={false} onChange={onChange} />
      );
    });
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    await act(async () => {
      (boxes[0] as HTMLInputElement).click();
    });
    expect(onChange).toHaveBeenCalledWith({ preferScreenShareFocus: expect.any(Boolean) });
  });

  it("respects disabled", async () => {
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    await act(async () => {
      root.render(
        <BroadcastAutoDirectingPolicyEditor policy={policy} disabled onChange={() => {}} />
      );
    });
    const debounceInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(debounceInput.disabled).toBe(true);
  });
});
