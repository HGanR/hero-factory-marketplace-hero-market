/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { BroadcastAutoDirectingPersistedState } from "@/lib/meet/broadcast-auto-directing-store";
import type { BroadcastLiveSceneState } from "@/lib/meet/broadcast-live-scenes";
import { getDefaultSceneConfig } from "@/lib/meet/broadcast-scene";
import { buildBroadcastCompositorRenderModel } from "@/lib/meet/broadcast-compositor";
import { buildBroadcastProgramState } from "@/lib/meet/broadcast-program";
import { getDefaultBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";

type GEngine = {
  __adEngineTestMap?: Map<number, BroadcastAutoDirectingPersistedState>;
  __liveEngineTestMap?: Map<number, BroadcastLiveSceneState>;
};

function g(): GEngine {
  return globalThis as unknown as GEngine;
}

jest.mock("@/lib/meet/broadcast-auto-directing-store", () => {
  const { getDefaultBroadcastAutoDirectingPolicy } = jest.requireActual("@/lib/meet/broadcast-auto-directing");
  const gg = globalThis as unknown as GEngine;
  if (!gg.__adEngineTestMap) gg.__adEngineTestMap = new Map();
  const m = gg.__adEngineTestMap;
  const defaultState = (userId: number): BroadcastAutoDirectingPersistedState => ({
    policy: getDefaultBroadcastAutoDirectingPolicy(),
    lastDecision: null,
    lastAppliedAt: null,
    lastAppliedLayoutMode: null,
    manualOverrideUntilIso: null,
    updatedByUserId: userId,
    debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
  });
  return {
    getBroadcastAutoDirectingState: jest.fn(async (id: number) => {
      const row = m.get(id);
      return row ? { ...row } : null;
    }),
    ensureBroadcastAutoDirectingStateForSession: jest.fn(async (id: number, userId: number) => {
      const cur = m.get(id);
      if (cur) return { ...cur };
      const s = defaultState(userId);
      m.set(id, { ...s });
      return { ...s };
    }),
    upsertBroadcastAutoDirectingState: jest.fn(async (params: { broadcastSessionId: number; state: BroadcastAutoDirectingPersistedState }) => {
      m.set(params.broadcastSessionId, { ...params.state });
    }),
  };
});

jest.mock("@/lib/meet/broadcast-live-scene-store", () => {
  const { getDefaultLiveSceneStateFromSession } = jest.requireActual("@/lib/meet/broadcast-live-scenes");
  const gg = globalThis as unknown as GEngine;
  if (!gg.__liveEngineTestMap) gg.__liveEngineTestMap = new Map();
  const liveM = gg.__liveEngineTestMap;
  return {
    getBroadcastLiveSceneState: jest.fn(async (id: number) => {
      const row = liveM.get(id);
      return row ? { ...row } : null;
    }),
    upsertBroadcastLiveSceneState: jest.fn(async (state: BroadcastLiveSceneState) => {
      liveM.set(state.broadcastSessionId, { ...state });
    }),
    ensureBroadcastLiveSceneStateForSession: jest.fn(async (session: { id: number; userId: number; layoutMode: string; sceneConfigJson: unknown }) => {
      const cur = liveM.get(session.id);
      if (cur) return { ...cur };
      const s = getDefaultLiveSceneStateFromSession(session, session.userId);
      liveM.set(session.id, { ...s });
      return { ...s };
    }),
  };
});

jest.mock("@/lib/meet/broadcast-render-sessions", () => ({
  getLatestBroadcastRenderSessionForBroadcast: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-event-publisher", () => ({
  publishAutoDirectingApplied: jest.fn(),
  publishAutoDirectingDecision: jest.fn(),
  publishAutoDirectingUpdated: jest.fn(),
  publishLiveSceneUpdated: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-metrics", () => ({
  incrementBroadcastAutoDirectingApply: jest.fn(),
  incrementBroadcastAutoDirectingDecision: jest.fn(),
  incrementBroadcastAutoDirectingError: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-audit", () => ({
  broadcastAudit: jest.fn(),
}));

import { getLatestBroadcastRenderSessionForBroadcast } from "@/lib/meet/broadcast-render-sessions";
import {
  publishAutoDirectingApplied,
  publishAutoDirectingDecision,
  publishAutoDirectingUpdated,
} from "@/lib/meet/broadcast-event-publisher";
import {
  incrementBroadcastAutoDirectingApply,
  incrementBroadcastAutoDirectingDecision,
  incrementBroadcastAutoDirectingError,
} from "@/lib/meet/broadcast-metrics";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { evaluateBroadcastAutoDirectingForSession, type SessionRow } from "@/lib/meet/broadcast-auto-directing-engine";
import { upsertBroadcastLiveSceneState } from "@/lib/meet/broadcast-live-scene-store";

function baseSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 9001,
    userId: 200,
    roomId: "room-engine",
    status: "active",
    layoutMode: "grid",
    sceneConfigJson: null,
    compositorMode: "v2_rendered_template",
    renderSessionId: 42,
    compositorFallbackFromV2: false,
    ...overrides,
  } as SessionRow;
}

function buildModel(params: {
  screenShare?: boolean;
  primarySpeakerId?: string | null;
  highlightedParticipantIds?: string[];
  anyPortrait?: boolean;
  orientation?: "portrait" | "landscape" | "auto";
}) {
  const scene = { ...getDefaultSceneConfig(), layoutMode: "gallery" as const };
  const room = {
    participantIds: params.highlightedParticipantIds ?? [],
    screenShareTrackPublished: Boolean(params.screenShare),
    primarySpeakerId: params.primarySpeakerId ?? null,
  };
  const prog = buildBroadcastProgramState(scene, room, {
    platforms: ["twitch"],
    anyPortraitCapable: Boolean(params.anyPortrait),
  });
  const m = buildBroadcastCompositorRenderModel(scene, prog, { platforms: ["twitch"] });
  return {
    ...m,
    screenShareActive: Boolean(params.screenShare),
    primarySpeakerId: params.primarySpeakerId ?? m.primarySpeakerId,
    highlightedParticipantIds: params.highlightedParticipantIds ?? m.highlightedParticipantIds,
    orientation: params.orientation ?? m.orientation,
    providerHints: { platforms: ["twitch"], anyPortraitCapable: Boolean(params.anyPortrait) },
  };
}

beforeEach(() => {
  g().__adEngineTestMap?.clear();
  g().__liveEngineTestMap?.clear();
  jest.clearAllMocks();
});

describe("broadcast-auto-directing-engine", () => {
  it("suggest_only persists decision without mutating live scene layout", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "suggest_only";
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({ screenShare: true }),
    });

    await evaluateBroadcastAutoDirectingForSession(session.id, session, new Date().toISOString());

    const ad = g().__adEngineTestMap!.get(session.id)!;
    expect(ad.lastDecision?.recommendedLayoutMode).toBe("screenshare_focus");
    expect(upsertBroadcastLiveSceneState).not.toHaveBeenCalled();
    expect(incrementBroadcastAutoDirectingApply).not.toHaveBeenCalled();
    expect(publishAutoDirectingApplied).not.toHaveBeenCalled();
    expect(publishAutoDirectingDecision).toHaveBeenCalled();
  });

  it("auto_apply updates live layout only and preserves non-layout fields", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "auto_apply";
    policy.speakerSwitchDebounceMs = 0;
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: "spk-1", lastFlipAtIso: "2020-01-01T00:00:00.000Z" },
    });

    const live: BroadcastLiveSceneState = {
      broadcastSessionId: session.id,
      sceneType: "program",
      layoutMode: "gallery",
      branding: {},
      showParticipantNames: true,
      showMutedIndicators: true,
      showFooter: true,
      portraitSafe: false,
      screenSharePriority: false,
      customHeadline: "Keep me",
      customSubheadline: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByUserId: session.userId,
    };
    g().__liveEngineTestMap!.set(session.id, { ...live });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({ screenShare: true }),
    });

    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:00.000Z");

    expect(upsertBroadcastLiveSceneState).toHaveBeenCalled();
    const arg = (upsertBroadcastLiveSceneState as jest.Mock).mock.calls[0][0] as BroadcastLiveSceneState;
    expect(arg.layoutMode).toBe("screenshare_focus");
    expect(arg.customHeadline).toBe("Keep me");
    expect(arg.sceneType).toBe("program");
    expect(incrementBroadcastAutoDirectingApply).toHaveBeenCalled();
    expect(publishAutoDirectingApplied).toHaveBeenCalled();
    expect(publishAutoDirectingUpdated).toHaveBeenCalled();
    expect(broadcastAudit).toHaveBeenCalledWith(
      "broadcast_auto_directing_applied",
      expect.objectContaining({ broadcastSessionId: session.id, source: "auto" })
    );
  });

  it("manual override blocks auto-apply but still records decision", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "auto_apply";
    policy.speakerSwitchDebounceMs = 0;
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: "2099-01-01T00:00:00.000Z",
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: "spk-1", lastFlipAtIso: "2020-01-01T00:00:00.000Z" },
    });
    g().__liveEngineTestMap!.set(session.id, {
      broadcastSessionId: session.id,
      sceneType: "program",
      layoutMode: "gallery",
      branding: {},
      showParticipantNames: true,
      showMutedIndicators: true,
      showFooter: true,
      portraitSafe: false,
      screenSharePriority: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByUserId: session.userId,
    });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({ screenShare: true }),
    });

    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:00.000Z");

    expect(g().__adEngineTestMap!.get(session.id)!.lastDecision?.recommendedLayoutMode).toBe("screenshare_focus");
    expect(upsertBroadcastLiveSceneState).not.toHaveBeenCalled();
    expect(incrementBroadcastAutoDirectingApply).not.toHaveBeenCalled();
  });

  it("weak signals avoid apply for low-confidence paths", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "auto_apply";
    policy.galleryParticipantThreshold = 99;
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });
    g().__liveEngineTestMap!.set(session.id, {
      broadcastSessionId: session.id,
      sceneType: "program",
      layoutMode: "gallery",
      branding: {},
      showParticipantNames: true,
      showMutedIndicators: true,
      showFooter: true,
      portraitSafe: false,
      screenSharePriority: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByUserId: session.userId,
    });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({
        screenShare: false,
        primarySpeakerId: null,
        highlightedParticipantIds: [],
      }),
    });

    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:00.000Z");

    expect(g().__adEngineTestMap!.get(session.id)!.lastDecision?.reason).toMatch(/signals_weak/);
    expect(upsertBroadcastLiveSceneState).not.toHaveBeenCalled();
    expect(incrementBroadcastAutoDirectingApply).not.toHaveBeenCalled();
  });

  it("prefers portrait_speaker when portrait-capable and dominant speaker", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "suggest_only";
    policy.preferPortraitLayouts = true;
    policy.speakerSwitchDebounceMs = 0;
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: "u1", lastFlipAtIso: "2020-01-01T00:00:00.000Z" },
    });
    g().__liveEngineTestMap!.set(session.id, {
      broadcastSessionId: session.id,
      sceneType: "program",
      layoutMode: "gallery",
      branding: {},
      showParticipantNames: true,
      showMutedIndicators: true,
      showFooter: true,
      portraitSafe: false,
      screenSharePriority: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByUserId: session.userId,
    });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({
        primarySpeakerId: "u1",
        highlightedParticipantIds: ["u1"],
        anyPortrait: true,
        orientation: "auto",
      }),
    });

    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:00.000Z");

    expect(g().__adEngineTestMap!.get(session.id)!.lastDecision?.recommendedLayoutMode).toBe("portrait_speaker");
  });

  it("debounces speaker layout applies until debounce window elapses", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "auto_apply";
    policy.speakerSwitchDebounceMs = 60_000;
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });
    g().__liveEngineTestMap!.set(session.id, {
      broadcastSessionId: session.id,
      sceneType: "program",
      layoutMode: "gallery",
      branding: {},
      showParticipantNames: true,
      showMutedIndicators: true,
      showFooter: true,
      portraitSafe: false,
      screenSharePriority: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByUserId: session.userId,
    });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({
        primarySpeakerId: "flip",
        highlightedParticipantIds: ["flip"],
        anyPortrait: false,
      }),
    });

    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:00.000Z");
    expect(upsertBroadcastLiveSceneState).not.toHaveBeenCalled();

    (upsertBroadcastLiveSceneState as jest.Mock).mockClear();
    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:01.000Z");
    expect(upsertBroadcastLiveSceneState).not.toHaveBeenCalled();

    (upsertBroadcastLiveSceneState as jest.Mock).mockClear();
    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:01:30.000Z");
    expect(upsertBroadcastLiveSceneState).toHaveBeenCalled();
  });

  it("does not publish decision when recommendation unchanged", async () => {
    const session = baseSession();
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "suggest_only";
    g().__adEngineTestMap!.set(session.id, {
      policy,
      lastDecision: {
        recommendedLayoutMode: "screenshare_focus",
        reason: "screen_share_active",
        confidence: "high",
        shouldApply: true,
      },
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });

    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockResolvedValue({
      renderModelJson: buildModel({ screenShare: true }),
    });

    (publishAutoDirectingDecision as jest.Mock).mockClear();
    await evaluateBroadcastAutoDirectingForSession(session.id, session, "2030-06-01T12:00:00.000Z");
    expect(publishAutoDirectingDecision).not.toHaveBeenCalled();
    expect(incrementBroadcastAutoDirectingDecision).not.toHaveBeenCalled();
  });

  it("no-ops for non-V2 session", async () => {
    const session = baseSession({
      compositorMode: "v1_livekit_default",
      renderSessionId: null,
    });
    await evaluateBroadcastAutoDirectingForSession(session.id, session, new Date().toISOString());
    expect(getLatestBroadcastRenderSessionForBroadcast).not.toHaveBeenCalled();
    expect(g().__adEngineTestMap!.get(session.id)).toBeUndefined();
  });

  it("increments error metric when evaluation throws", async () => {
    const session = baseSession();
    g().__adEngineTestMap!.set(session.id, {
      policy: getDefaultBroadcastAutoDirectingPolicy(),
      lastDecision: null,
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: null,
      updatedByUserId: session.userId,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });
    (getLatestBroadcastRenderSessionForBroadcast as jest.Mock).mockRejectedValue(new Error("render_row_failed"));
    await evaluateBroadcastAutoDirectingForSession(session.id, session, new Date().toISOString());
    expect(incrementBroadcastAutoDirectingError).toHaveBeenCalled();
  });
});
