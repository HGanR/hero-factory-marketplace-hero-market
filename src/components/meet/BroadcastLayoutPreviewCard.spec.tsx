/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { BroadcastLayoutPreviewCard } from "./BroadcastLayoutPreviewCard";

describe("BroadcastLayoutPreviewCard", () => {
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

  it("renders layout title for gallery", async () => {
    await act(async () => {
      root.render(<BroadcastLayoutPreviewCard layoutMode="gallery" />);
    });
    expect(container.querySelector('[data-testid="broadcast-layout-preview-card"]')?.textContent).toMatch(/Gallery/i);
  });
});
