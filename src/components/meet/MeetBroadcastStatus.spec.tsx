/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { MeetBroadcastStatus } from "./MeetBroadcastStatus";

describe("MeetBroadcastStatus", () => {
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

  it("renders nothing when no session status", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus sessionStatus={null} destinations={[]} layoutMode="grid" />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-status"]')).toBeNull();
  });

  it("renders destination pills for active and failed states", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[
            {
              id: 1,
              streamDestinationId: 10,
              platform: "twitch",
              label: "T1",
              resolvedOutputUrlMasked: "rtmp://x/****abcd",
              status: "active",
              lastError: null,
            },
            {
              id: 2,
              streamDestinationId: 11,
              platform: "tiktok",
              label: "TT",
              resolvedOutputUrlMasked: "rtmp://y/****efgh",
              status: "failed",
              lastError: "connection reset",
            },
          ]}
          layoutMode="grid"
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-status"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="meet-broadcast-dest-pill-1"]')?.textContent).toMatch(/active/i);
    expect(container.querySelector('[data-testid="meet-broadcast-dest-pill-2"]')?.textContent).toMatch(/failed/i);
    expect(container.textContent).toContain("connection reset");
  });

  it("shows degraded banner when degraded is true", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          degraded
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-status"]')?.textContent).toMatch(/Live with errors/i);
  });

  it("shows linked broadcast event summary on scene preview when provided", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: true,
            brandingEnabled: false,
            screenSharePriority: false,
            presetName: null,
            broadcastEventSummary: {
              id: 1,
              title: "Product update",
              scheduledStartIso: "2026-09-01T17:00:00.000Z",
              status: "live",
              timelineTemplateName: "5m countdown + CTA",
              launchedFromEvent: true,
            },
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-event-summary"]')).toBeTruthy();
    expect(container.textContent).toContain("Product update");
    expect(container.textContent).toContain("5m countdown + CTA");
  });

  it("shows portrait orientation note when a portrait-capable platform is in single-speaker layout", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[
            {
              id: 1,
              streamDestinationId: 10,
              platform: "instagram",
              label: "IG",
              resolvedOutputUrlMasked: "rtmps://…/****1234",
              status: "active",
              lastError: null,
            },
          ]}
          layoutMode="single-speaker"
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-orient-warning"]')?.textContent).toMatch(
      /Portrait orientation recommended/i
    );
  });

  it("shows realtime status when V2 template active", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: false,
            brandingEnabled: true,
            screenSharePriority: false,
            presetName: null,
            compositorMode: "v2_rendered_template",
            compositorFallbackFromV2: false,
            renderSessionMasked: "rs_****12",
            templateActive: true,
            brandingRendered: true,
          }}
          broadcastRealtimeConnected
          broadcastRealtimeUsePollingFallback={false}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-realtime-status"]')?.textContent).toMatch(/Realtime/i);
    expect(container.querySelector('[data-testid="meet-broadcast-realtime-connected"]')?.textContent).toMatch(/Connected/);
  });

  it("shows compositor summary for V2 fields", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: false,
            brandingEnabled: true,
            screenSharePriority: false,
            presetName: null,
            compositorMode: "v2_rendered_template",
            compositorFallbackFromV2: false,
            renderSessionMasked: "rs_****12",
            templateActive: true,
            brandingRendered: true,
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-compositor-summary"]')?.textContent).toMatch(
      /V2 rendered template/i
    );
  });

  it("shows overlay summary when templateActive and overlaySummary are set", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: false,
            brandingEnabled: true,
            screenSharePriority: false,
            presetName: null,
            compositorMode: "v2_rendered_template",
            compositorFallbackFromV2: false,
            renderSessionMasked: "rs_****12",
            templateActive: true,
            brandingRendered: true,
            overlaySummary: {
              lowerThirdVisible: true,
              tickerVisible: false,
              ctaBannerVisible: true,
              updatedAt: "2026-04-10T12:00:00.000Z",
            },
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-overlay-summary"]')?.textContent).toMatch(/Lower third: on/);
  });

  it("shows schedule summary when templateActive and scheduleSummary are set", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: false,
            brandingEnabled: true,
            screenSharePriority: false,
            presetName: null,
            compositorMode: "v2_rendered_template",
            compositorFallbackFromV2: false,
            renderSessionMasked: "rs_****12",
            templateActive: true,
            brandingRendered: true,
            scheduleSummary: {
              automationEnabled: true,
              countdownVisible: true,
              countdownTargetIso: "2026-04-10T15:00:00.000Z",
              nextScheduledActionAt: "2026-04-10T14:30:00.000Z",
              nextScheduledActionType: "switch_scene",
              lastExecutedActionId: "a1",
              lastEvaluatedAt: null,
            },
            scheduleUpdatedAt: "2026-04-10T12:00:00.000Z",
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-schedule-summary"]')?.textContent).toMatch(
      /Automation: on/
    );
    expect(container.querySelector('[data-testid="meet-broadcast-schedule-summary"]')?.textContent).toMatch(/switch_scene/);
  });

  it("shows live scene summary when templateActive and liveScene are set", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: false,
            brandingEnabled: true,
            screenSharePriority: false,
            presetName: null,
            compositorMode: "v2_rendered_template",
            compositorFallbackFromV2: false,
            renderSessionMasked: "rs_****12",
            templateActive: true,
            brandingRendered: true,
            liveScene: {
              sceneType: "brb",
              layoutMode: "gallery",
              updatedAt: "2026-04-10T12:00:00.000Z",
              updatedByUserId: 1,
            },
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-live-scene-summary"]')?.textContent).toMatch(/brb/);
  });

  it("renders scene preview when scenePreview is provided", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "portrait_speaker",
            portraitSafe: true,
            brandingEnabled: false,
            screenSharePriority: true,
            presetName: "Studio A",
          }}
        />
      );
    });
    const el = container.querySelector('[data-testid="meet-broadcast-scene-preview"]');
    expect(el?.textContent).toMatch(/portrait_speaker/);
    expect(el?.textContent).toMatch(/Studio A/);
    expect(el?.textContent).toMatch(/Portrait safe: on/);
  });

  it("shows layout orientation warning for landscape scene with portrait-capable destination", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[
            {
              id: 1,
              streamDestinationId: 10,
              platform: "tiktok",
              label: "TT",
              resolvedOutputUrlMasked: "rtmp://y/****efgh",
              status: "active",
              lastError: null,
            },
          ]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "speaker",
            portraitSafe: false,
            brandingEnabled: false,
            screenSharePriority: false,
            presetName: null,
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-layout-orient-warn"]')?.textContent).toMatch(
      /Selected layout may not match provider orientation/i
    );
  });

  it("shows portrait-safe recommendation when vertical destination and portrait safe is off", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[
            {
              id: 1,
              streamDestinationId: 10,
              platform: "instagram",
              label: "IG",
              resolvedOutputUrlMasked: "rtmps://…/****1234",
              status: "active",
              lastError: null,
            },
          ]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "portrait_speaker",
            portraitSafe: false,
            brandingEnabled: false,
            screenSharePriority: false,
            presetName: null,
          }}
        />
      );
    });
    expect(container.querySelector('[data-testid="meet-broadcast-portrait-safe-warn"]')?.textContent).toMatch(
      /Portrait-safe framing is recommended for Instagram\/TikTok/i
    );
  });

  it("renders capability badges inside destination pills", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[
            {
              id: 1,
              streamDestinationId: 10,
              platform: "twitch",
              label: "T1",
              resolvedOutputUrlMasked: "rtmp://x/****abcd",
              status: "active",
              lastError: null,
            },
          ]}
          layoutMode="grid"
        />
      );
    });
    const pill = container.querySelector('[data-testid="meet-broadcast-dest-pill-1"]');
    expect(pill?.querySelector('[data-testid="badge-ingest-stability"]')?.textContent).toMatch(/Stable ingest/i);
  });

  it("renders auto-directing summary when V2 template is active", async () => {
    await act(async () => {
      root.render(
        <MeetBroadcastStatus
          sessionStatus="active"
          destinations={[]}
          layoutMode="grid"
          scenePreview={{
            layoutMode: "gallery",
            portraitSafe: true,
            brandingEnabled: true,
            screenSharePriority: false,
            presetName: null,
            templateActive: true,
            compositorMode: "v2_rendered_template",
          }}
          autoDirectingSummary={{
            mode: "suggest_only",
            latestRecommendedLayout: "speaker",
            latestReason: "single_dominant_speaker",
            latestConfidence: "medium",
            manualOverrideActive: true,
            lastAppliedAt: null,
          }}
        />
      );
    });
    const block = container.querySelector('[data-testid="meet-broadcast-auto-directing-summary"]');
    expect(block?.textContent).toMatch(/Auto-directing/i);
    expect(block?.textContent).toMatch(/suggest_only/);
    expect(block?.textContent).toMatch(/manual override/);
    expect(block?.textContent).toMatch(/speaker/);
  });
});
