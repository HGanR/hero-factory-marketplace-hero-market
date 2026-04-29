/**
 * V2-only operator overlays (polling + server truth). V1 unchanged.
 */

import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";
import type { BroadcastProgramState } from "./broadcast-program";
import type { BroadcastLiveSceneState } from "./broadcast-live-scenes";

export const BROADCAST_OVERLAY_TYPES = ["lower_third", "ticker", "cta_banner"] as const;
export type BroadcastOverlayType = (typeof BROADCAST_OVERLAY_TYPES)[number];

export type BroadcastLowerThird = {
  visible: boolean;
  headline?: string;
  subheadline?: string;
  position?: "bottom_left" | "bottom_center";
  accentHex?: string;
};

export type BroadcastTicker = {
  visible: boolean;
  text?: string;
  speed?: "slow" | "normal";
  accentHex?: string;
};

export type BroadcastCtaBanner = {
  visible: boolean;
  text?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  position?: "top" | "bottom";
  accentHex?: string;
};

export type BroadcastOverlayState = {
  broadcastSessionId: number;
  lowerThird: BroadcastLowerThird;
  ticker: BroadcastTicker;
  ctaBanner: BroadcastCtaBanner;
  updatedAt: string;
  updatedByUserId: number;
};

/** Embedded in `BroadcastCompositorRenderModel.overlays` for the egress template. */
export type BroadcastOverlayRenderPayload = {
  portraitSafe: boolean;
  lowerThird: BroadcastLowerThird;
  ticker: BroadcastTicker;
  ctaBanner: BroadcastCtaBanner;
};

const HEADLINE_MAX = 120;
const SUBHEAD_MAX = 180;
const TICKER_MAX = 500;
const CTA_TEXT_MAX = 200;
const CTA_LABEL_MAX = 80;
const URL_MAX = 2048;

export function getDefaultLowerThird(): BroadcastLowerThird {
  return { visible: false, position: "bottom_left" };
}

export function getDefaultTicker(): BroadcastTicker {
  return { visible: false, speed: "normal" };
}

export function getDefaultCtaBanner(): BroadcastCtaBanner {
  return { visible: false, position: "top" };
}

export function getDefaultOverlayState(broadcastSessionId: number, updatedByUserId: number): BroadcastOverlayState {
  return {
    broadcastSessionId,
    lowerThird: getDefaultLowerThird(),
    ticker: getDefaultTicker(),
    ctaBanner: getDefaultCtaBanner(),
    updatedAt: new Date().toISOString(),
    updatedByUserId,
  };
}

function trimStr(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

export function isHexAccent(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  return /^#?[0-9A-Fa-f]{6}$/.test(s);
}

function normalizeAccentHex(s: string): string | undefined {
  const t = s.trim();
  if (!/^#?[0-9A-Fa-f]{6}$/.test(t)) return undefined;
  return t.startsWith("#") ? t : `#${t}`;
}

/** http(s) only; rejects javascript:, data:, etc. */
export function isAllowedOverlayUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (s.length > URL_MAX) return false;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  const p = u.protocol.toLowerCase();
  if (p !== "http:" && p !== "https:") return false;
  if (u.username || u.password) return false;
  return true;
}

export function validateBroadcastOverlayState(
  input: unknown
): { ok: true; state: BroadcastOverlayState } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input == null || typeof input !== "object") {
    return { ok: false, errors: ["state must be an object"] };
  }
  const o = input as Record<string, unknown>;
  const sid = o.broadcastSessionId;
  if (typeof sid !== "number" || !Number.isFinite(sid) || sid <= 0) errors.push("invalid broadcastSessionId");
  const uid = o.updatedByUserId;
  if (typeof uid !== "number" || !Number.isFinite(uid) || uid <= 0) errors.push("invalid updatedByUserId");
  const updatedAt = o.updatedAt;
  if (typeof updatedAt !== "string" || !updatedAt.trim()) errors.push("invalid updatedAt");

  const lt = o.lowerThird;
  if (lt == null || typeof lt !== "object") errors.push("invalid lowerThird");
  const tk = o.ticker;
  if (tk == null || typeof tk !== "object") errors.push("invalid ticker");
  const cta = o.ctaBanner;
  if (cta == null || typeof cta !== "object") errors.push("invalid ctaBanner");

  if (errors.length) return { ok: false, errors };

  const lto = lt as Record<string, unknown>;
  if (typeof lto.visible !== "boolean") errors.push("invalid lowerThird.visible");
  const pos = lto.position;
  if (pos !== undefined && pos !== "bottom_left" && pos !== "bottom_center") {
    errors.push("invalid lowerThird.position");
  }
  if (lto.accentHex !== undefined && lto.accentHex !== null && !isHexAccent(lto.accentHex)) errors.push("invalid lowerThird.accentHex");

  const tko = tk as Record<string, unknown>;
  if (typeof tko.visible !== "boolean") errors.push("invalid ticker.visible");
  const sp = tko.speed;
  if (sp !== undefined && sp !== "slow" && sp !== "normal") errors.push("invalid ticker.speed");
  if (tko.accentHex !== undefined && tko.accentHex !== null && !isHexAccent(tko.accentHex)) errors.push("invalid ticker.accentHex");

  const ctao = cta as Record<string, unknown>;
  if (typeof ctao.visible !== "boolean") errors.push("invalid ctaBanner.visible");
  const cpos = ctao.position;
  if (cpos !== undefined && cpos !== "top" && cpos !== "bottom") errors.push("invalid ctaBanner.position");
  if (ctao.accentHex !== undefined && ctao.accentHex !== null && !isHexAccent(ctao.accentHex)) errors.push("invalid ctaBanner.accentHex");
  const urlRaw = trimStr(ctao.buttonUrl, URL_MAX);
  if (ctao.buttonUrl !== undefined && ctao.buttonUrl !== null && typeof ctao.buttonUrl === "string" && ctao.buttonUrl.trim()) {
    if (!urlRaw || !isAllowedOverlayUrl(urlRaw)) errors.push("invalid ctaBanner.buttonUrl");
  }

  if (errors.length) return { ok: false, errors };

  const lowerThird: BroadcastLowerThird = {
    visible: Boolean(lto.visible),
    headline: trimStr(lto.headline, HEADLINE_MAX),
    subheadline: trimStr(lto.subheadline, SUBHEAD_MAX),
    position: (pos as BroadcastLowerThird["position"]) ?? "bottom_left",
    accentHex: isHexAccent(lto.accentHex) ? normalizeAccentHex(lto.accentHex as string) : undefined,
  };

  const ticker: BroadcastTicker = {
    visible: Boolean(tko.visible),
    text: trimStr(tko.text, TICKER_MAX),
    speed: (sp as BroadcastTicker["speed"]) ?? "normal",
    accentHex: isHexAccent(tko.accentHex) ? normalizeAccentHex(tko.accentHex as string) : undefined,
  };

  const ctaBanner: BroadcastCtaBanner = {
    visible: Boolean(ctao.visible),
    text: trimStr(ctao.text, CTA_TEXT_MAX),
    buttonLabel: trimStr(ctao.buttonLabel, CTA_LABEL_MAX),
    buttonUrl: urlRaw && isAllowedOverlayUrl(urlRaw) ? urlRaw : undefined,
    position: (cpos as BroadcastCtaBanner["position"]) ?? "top",
    accentHex: isHexAccent(ctao.accentHex) ? normalizeAccentHex(ctao.accentHex as string) : undefined,
  };

  return {
    ok: true,
    state: {
      broadcastSessionId: sid as number,
      lowerThird,
      ticker,
      ctaBanner,
      updatedAt: String(updatedAt),
      updatedByUserId: uid as number,
    },
  };
}

export type BroadcastOverlayPatch = {
  lowerThird?: Partial<BroadcastLowerThird>;
  ticker?: Partial<BroadcastTicker>;
  ctaBanner?: Partial<BroadcastCtaBanner>;
};

export function mergeBroadcastOverlayPatch(existing: BroadcastOverlayState, patch: BroadcastOverlayPatch): BroadcastOverlayState {
  const lowerThird: BroadcastLowerThird = {
    ...existing.lowerThird,
    ...patch.lowerThird,
  };
  const ticker: BroadcastTicker = {
    ...existing.ticker,
    ...patch.ticker,
  };
  const ctaBanner: BroadcastCtaBanner = {
    ...existing.ctaBanner,
    ...patch.ctaBanner,
  };
  return {
    ...existing,
    lowerThird,
    ticker,
    ctaBanner,
  };
}

function programStateFromRenderModel(m: BroadcastCompositorRenderModel): BroadcastProgramState {
  return {
    layoutMode: m.layoutMode,
    portraitSafe: m.portraitSafe,
    branding: m.branding,
    primarySpeakerId: m.primarySpeakerId,
    highlightedParticipantIds: [...m.highlightedParticipantIds],
    screenShareActive: m.screenShareActive,
    programNotes: [...m.programNotes],
    providerHints: {
      platforms: [...m.providerHints.platforms],
      anyPortraitCapable: m.providerHints.anyPortraitCapable,
    },
  };
}

/**
 * Template-facing overlay slice (mirrors persisted state with portrait hint for spacing).
 */
export function buildOverlayRenderModel(
  overlayState: BroadcastOverlayState,
  sceneState: BroadcastLiveSceneState,
  programState: BroadcastProgramState
): BroadcastOverlayRenderPayload {
  void programState;
  return {
    portraitSafe: sceneState.portraitSafe,
    lowerThird: { ...overlayState.lowerThird },
    ticker: { ...overlayState.ticker },
    ctaBanner: { ...overlayState.ctaBanner },
  };
}

export function mergeOverlaysIntoRenderModel(
  model: BroadcastCompositorRenderModel,
  overlayState: BroadcastOverlayState,
  sceneState: BroadcastLiveSceneState
): BroadcastCompositorRenderModel {
  const payload = buildOverlayRenderModel(overlayState, sceneState, programStateFromRenderModel(model));
  return { ...model, overlays: payload };
}
