/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { BroadcastAutoDirectingStatusCard } from "./BroadcastAutoDirectingStatusCard";

describe("BroadcastAutoDirectingStatusCard", () => {
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

  it("renders empty state when summary missing", async () => {
    await act(async () => {
      root.render(<BroadcastAutoDirectingStatusCard summary={null} />);
    });
    expect(container.querySelector('[data-testid="broadcast-auto-directing-status-empty"]')).toBeTruthy();
  });

  it("renders mode, recommendation, override flag", async () => {
    await act(async () => {
      root.render(
        <BroadcastAutoDirectingStatusCard
          summary={{
            mode: "suggest_only",
            latestRecommendedLayout: "gallery",
            latestReason: "participant_or_speaker_count",
            latestConfidence: "medium",
            manualOverrideActive: false,
            lastAppliedAt: null,
          }}
        />
      );
    });
    const card = container.querySelector('[data-testid="broadcast-auto-directing-status-card"]');
    expect(card?.textContent).toContain("suggest_only");
    expect(card?.textContent).toContain("gallery");
    expect(card?.textContent).toContain("participant_or_speaker_count");
    expect(container.querySelector('[data-testid="broadcast-auto-directing-override-active"]')?.textContent).toMatch(
      /inactive/
    );
  });

  it("shows active manual override copy", async () => {
    await act(async () => {
      root.render(
        <BroadcastAutoDirectingStatusCard
          summary={{
            mode: "auto_apply",
            latestRecommendedLayout: "speaker",
            latestReason: "x",
            latestConfidence: "high",
            manualOverrideActive: true,
            lastAppliedAt: "2026-01-01T00:00:00.000Z",
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="broadcast-auto-directing-override-active"]')?.textContent).toMatch(
      /active \(auto-apply paused\)/
    );
  });
});
