/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { BroadcastProviderBadges } from "./BroadcastProviderBadges";

describe("BroadcastProviderBadges", () => {
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

  it("shows Stable ingest for twitch", async () => {
    await act(async () => {
      root.render(<BroadcastProviderBadges platform="twitch" />);
    });
    expect(container.querySelector('[data-testid="badge-ingest-stability"]')?.textContent).toMatch(/Stable ingest/i);
    expect(container.querySelector('[data-testid="badge-manual-go-live"]')).toBeNull();
  });

  it("shows Best effort, manual go live, and portrait for tiktok", async () => {
    await act(async () => {
      root.render(<BroadcastProviderBadges platform="tiktok" />);
    });
    expect(container.querySelector('[data-testid="badge-ingest-stability"]')?.textContent).toMatch(/Best effort/i);
    expect(container.querySelector('[data-testid="badge-manual-go-live"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="badge-portrait"]')).toBeTruthy();
  });
});
