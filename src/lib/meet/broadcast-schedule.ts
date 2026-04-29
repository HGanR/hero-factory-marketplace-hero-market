/**
 * V2-only broadcast schedule: countdown + timed automation (polling-evaluated on server).
 */

import type { BroadcastLiveSceneState, BroadcastLiveSceneType, LiveScenePatch } from "./broadcast-live-scenes";
import { mergeLiveScenePatch, validateLiveSceneState } from "./broadcast-live-scenes";
import type { BroadcastLayoutMode } from "./broadcast-scene";
import { BROADCAST_LAYOUT_MODES } from "./broadcast-scene";
import type { BroadcastOverlayState, BroadcastOverlayPatch } from "./broadcast-overlays";
import { mergeBroadcastOverlayPatch, validateBroadcastOverlayState } from "./broadcast-overlays";
import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";

export const BROADCAST_SCHEDULED_ACTION_TYPES = [
  "switch_scene",
  "reset_scene_to_program",
  "show_overlay",
  "hide_overlay",
  "update_overlay",
  "start_countdown",
  "stop_countdown",
] as const;
export type BroadcastScheduledActionType = (typeof BROADCAST_SCHEDULED_ACTION_TYPES)[number];

export type BroadcastCountdownConfig = {
  visible: boolean;
  targetTimeIso?: string;
  label?: string;
  position?: "top_right" | "top_center" | "bottom_right";
  accentHex?: string;
};

export type BroadcastScheduledAction = {
  id: string;
  actionType: BroadcastScheduledActionType;
  executeAtIso: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  /** Set when automation executed this action (idempotent). */
  executedAtIso?: string;
};

export type BroadcastScheduleState = {
  broadcastSessionId: number;
  countdown: BroadcastCountdownConfig;
  actions: BroadcastScheduledAction[];
  automationEnabled: boolean;
  lastEvaluatedAt?: string;
  lastExecutedActionId?: string;
  updatedAt: string;
  updatedByUserId: number;
};

export type BroadcastSchedulePatch = {
  automationEnabled?: boolean;
  countdown?: Partial<BroadcastCountdownConfig>;
  actions?: BroadcastScheduledAction[];
};

/** Merged onto render model for egress template. */
export type BroadcastCountdownRenderPayload = {
  visible: boolean;
  label?: string;
  position: NonNullable<BroadcastCountdownConfig["position"]>;
  accentHex?: string;
  remainingSeconds: number;
  displayTime: string;
  targetPassed: boolean;
};

export const MAX_SCHEDULED_ACTIONS = 50;
const ACTION_ID_MAX = 64;
const COUNTDOWN_LABEL_MAX = 120;

function isValidIsoDateTime(s: string): boolean {
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

function isHexAccent(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const x = v.trim();
  return /^#?[0-9A-Fa-f]{6}$/.test(x);
}

function normalizeHex(s: string): string | undefined {
  const t = s.trim();
  if (!/^#?[0-9A-Fa-f]{6}$/.test(t)) return undefined;
  return t.startsWith("#") ? t : `#${t}`;
}

export function getDefaultBroadcastScheduleState(
  broadcastSessionId: number,
  updatedByUserId: number
): BroadcastScheduleState {
  const now = new Date().toISOString();
  return {
    broadcastSessionId,
    countdown: { visible: false, position: "top_right" },
    actions: [],
    automationEnabled: false,
    lastEvaluatedAt: undefined,
    lastExecutedActionId: undefined,
    updatedAt: now,
    updatedByUserId,
  };
}

/** Exported for timeline templates and external callers that validate action payloads only. */
export function validateBroadcastScheduledActionPayload(
  actionType: BroadcastScheduledActionType,
  payload: unknown
): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (payload == null || typeof payload !== "object") {
    return { ok: false, errors: ["payload must be an object"] };
  }
  const p = payload as Record<string, unknown>;

  switch (actionType) {
    case "switch_scene": {
      const st = p.sceneType;
      if (typeof st !== "string" || !["program", "intro", "brb", "outro", "holding"].includes(st)) {
        errors.push("switch_scene requires payload.sceneType");
      }
      if (p.layoutMode !== undefined) {
        const lm = p.layoutMode;
        if (typeof lm !== "string" || !(BROADCAST_LAYOUT_MODES as readonly string[]).includes(lm)) {
          errors.push("invalid layoutMode");
        }
      }
      break;
    }
    case "reset_scene_to_program":
      break;
    case "show_overlay":
    case "hide_overlay": {
      const k = p.kind;
      if (k !== "lower_third" && k !== "ticker" && k !== "cta_banner") {
        errors.push("overlay actions require payload.kind");
      }
      break;
    }
    case "update_overlay": {
      const k = p.kind;
      if (k !== "lower_third" && k !== "ticker" && k !== "cta_banner") {
        errors.push("update_overlay requires payload.kind");
      }
      if (p.patch == null || typeof p.patch !== "object") {
        errors.push("update_overlay requires payload.patch object");
      }
      break;
    }
    case "start_countdown": {
      const tt = p.targetTimeIso;
      if (tt !== undefined && (typeof tt !== "string" || !isValidIsoDateTime(tt))) {
        errors.push("invalid start_countdown.targetTimeIso");
      }
      break;
    }
    case "stop_countdown":
      break;
    default:
      errors.push("unknown actionType");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, payload: p };
}

export function validateBroadcastScheduleState(
  input: unknown
): { ok: true; state: BroadcastScheduleState } | { ok: false; errors: string[] } {
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
  if (typeof o.automationEnabled !== "boolean") errors.push("invalid automationEnabled");

  const cd = o.countdown;
  if (cd == null || typeof cd !== "object") errors.push("invalid countdown");
  const acts = o.actions;
  if (!Array.isArray(acts)) errors.push("invalid actions");

  if (errors.length) return { ok: false, errors };

  const cdo = cd as Record<string, unknown>;
  if (typeof cdo.visible !== "boolean") errors.push("invalid countdown.visible");
  const cpos = cdo.position;
  if (cpos !== undefined && cpos !== "top_right" && cpos !== "top_center" && cpos !== "bottom_right") {
    errors.push("invalid countdown.position");
  }
  if (cdo.targetTimeIso !== undefined && cdo.targetTimeIso !== null) {
    if (typeof cdo.targetTimeIso !== "string" || !isValidIsoDateTime(cdo.targetTimeIso)) {
      errors.push("invalid countdown.targetTimeIso");
    }
  }
  if (cdo.label !== undefined && cdo.label !== null) {
    if (typeof cdo.label !== "string" || cdo.label.length > COUNTDOWN_LABEL_MAX) errors.push("invalid countdown.label");
  }
  if (cdo.accentHex !== undefined && cdo.accentHex !== null && !isHexAccent(cdo.accentHex)) {
    errors.push("invalid countdown.accentHex");
  }

  if ((acts as unknown[]).length > MAX_SCHEDULED_ACTIONS) {
    errors.push(`actions exceed max ${MAX_SCHEDULED_ACTIONS}`);
  }

  const seenIds = new Set<string>();
  const normalizedActions: BroadcastScheduledAction[] = [];

  for (let i = 0; i < (acts as unknown[]).length; i++) {
    const a = (acts as unknown[])[i];
    if (a == null || typeof a !== "object") {
      errors.push(`invalid action[${i}]`);
      continue;
    }
    const ao = a as Record<string, unknown>;
    const id = ao.id;
    if (typeof id !== "string" || !id.trim() || id.length > ACTION_ID_MAX) {
      errors.push(`invalid action[${i}].id`);
      continue;
    }
    if (seenIds.has(id)) {
      errors.push(`duplicate action id: ${id}`);
      continue;
    }
    seenIds.add(id);
    const at = ao.actionType;
    if (typeof at !== "string" || !(BROADCAST_SCHEDULED_ACTION_TYPES as readonly string[]).includes(at)) {
      errors.push(`invalid action[${i}].actionType`);
      continue;
    }
    const ex = ao.executeAtIso;
    if (typeof ex !== "string" || !isValidIsoDateTime(ex)) {
      errors.push(`invalid action[${i}].executeAtIso`);
      continue;
    }
    if (typeof ao.enabled !== "boolean") {
      errors.push(`invalid action[${i}].enabled`);
      continue;
    }
    const pay = ao.payload;
    if (pay == null || typeof pay !== "object") {
      errors.push(`invalid action[${i}].payload`);
      continue;
    }
    const pv = validateBroadcastScheduledActionPayload(at as BroadcastScheduledActionType, pay);
    if (!pv.ok) {
      errors.push(...pv.errors.map((e) => `action[${i}]: ${e}`));
      continue;
    }
    let executedAtIso: string | undefined;
    if (ao.executedAtIso !== undefined && ao.executedAtIso !== null) {
      if (typeof ao.executedAtIso !== "string" || !isValidIsoDateTime(ao.executedAtIso)) {
        errors.push(`invalid action[${i}].executedAtIso`);
        continue;
      }
      executedAtIso = ao.executedAtIso;
    }
    normalizedActions.push({
      id: id.trim(),
      actionType: at as BroadcastScheduledActionType,
      executeAtIso: ex,
      payload: pv.payload,
      enabled: ao.enabled,
      executedAtIso,
    });
  }

  if (errors.length) return { ok: false, errors };

  const countdown: BroadcastCountdownConfig = {
    visible: Boolean(cdo.visible),
    targetTimeIso:
      typeof cdo.targetTimeIso === "string" && isValidIsoDateTime(cdo.targetTimeIso) ? cdo.targetTimeIso : undefined,
    label:
      typeof cdo.label === "string" && cdo.label.trim()
        ? cdo.label.trim().slice(0, COUNTDOWN_LABEL_MAX)
        : undefined,
    position: (cdo.position as BroadcastCountdownConfig["position"]) ?? "top_right",
    accentHex: isHexAccent(cdo.accentHex) ? normalizeHex(cdo.accentHex as string) : undefined,
  };

  return {
    ok: true,
    state: {
      broadcastSessionId: sid as number,
      countdown,
      actions: normalizedActions,
      automationEnabled: Boolean(o.automationEnabled),
      lastEvaluatedAt: typeof o.lastEvaluatedAt === "string" ? o.lastEvaluatedAt : undefined,
      lastExecutedActionId: typeof o.lastExecutedActionId === "string" ? o.lastExecutedActionId : undefined,
      updatedAt: String(updatedAt),
      updatedByUserId: uid as number,
    },
  };
}

export function mergeBroadcastSchedulePatch(
  existing: BroadcastScheduleState,
  patch: BroadcastSchedulePatch
): BroadcastScheduleState {
  const next: BroadcastScheduleState = {
    ...existing,
    countdown: {
      ...existing.countdown,
      ...(patch.countdown ?? {}),
    },
  };
  if (patch.automationEnabled !== undefined) next.automationEnabled = patch.automationEnabled;
  if (patch.actions !== undefined) next.actions = patch.actions;
  return next;
}

export function getPendingScheduledActions(schedule: BroadcastScheduleState, nowIso: string): BroadcastScheduledAction[] {
  const now = Date.parse(nowIso);
  return schedule.actions
    .filter((a) => a.enabled && !a.executedAtIso && Date.parse(a.executeAtIso) > now)
    .sort((a, b) => Date.parse(a.executeAtIso) - Date.parse(b.executeAtIso));
}

export function getDueScheduledActions(schedule: BroadcastScheduleState, nowIso: string): BroadcastScheduledAction[] {
  const now = Date.parse(nowIso);
  return schedule.actions
    .filter((a) => a.enabled && !a.executedAtIso && Date.parse(a.executeAtIso) <= now)
    .sort((a, b) => Date.parse(a.executeAtIso) - Date.parse(b.executeAtIso));
}

export function getNextScheduledAction(
  schedule: BroadcastScheduleState,
  nowIso: string
): BroadcastScheduledAction | null {
  const pending = getPendingScheduledActions(schedule, nowIso);
  return pending[0] ?? null;
}

export function applyScheduledActionToLiveState(
  live: BroadcastLiveSceneState,
  action: BroadcastScheduledAction,
  _sessionUserId: number
): { ok: true; state: BroadcastLiveSceneState } | { ok: false; errors: string[] } {
  const now = new Date().toISOString();
  if (action.actionType !== "switch_scene") {
    return { ok: false, errors: ["not a live scene action"] };
  }
  const p = action.payload;
  const patch: LiveScenePatch = {
    sceneType: p.sceneType as BroadcastLiveSceneType,
    layoutMode: p.layoutMode as BroadcastLayoutMode | undefined,
    customHeadline: p.customHeadline as string | undefined,
    customSubheadline: p.customSubheadline as string | undefined,
  };
  const merged = mergeLiveScenePatch(live, patch);
  const v = validateLiveSceneState({
    ...merged,
    updatedAt: now,
    updatedByUserId: live.updatedByUserId,
    broadcastSessionId: live.broadcastSessionId,
  });
  return v.ok ? { ok: true, state: v.state } : { ok: false, errors: v.errors };
}

export function applyScheduledActionToOverlayState(
  overlay: BroadcastOverlayState,
  action: BroadcastScheduledAction,
  _sessionUserId: number
): { ok: true; state: BroadcastOverlayState } | { ok: false; errors: string[] } {
  const now = new Date().toISOString();
  const p = action.payload;
  const kind = p.kind as string;

  let patch: BroadcastOverlayPatch = {};
  if (action.actionType === "show_overlay") {
    if (kind === "lower_third") patch = { lowerThird: { visible: true } };
    else if (kind === "ticker") patch = { ticker: { visible: true } };
    else if (kind === "cta_banner") patch = { ctaBanner: { visible: true } };
    else return { ok: false, errors: ["bad overlay kind"] };
  } else if (action.actionType === "hide_overlay") {
    if (kind === "lower_third") patch = { lowerThird: { visible: false } };
    else if (kind === "ticker") patch = { ticker: { visible: false } };
    else if (kind === "cta_banner") patch = { ctaBanner: { visible: false } };
    else return { ok: false, errors: ["bad overlay kind"] };
  } else if (action.actionType === "update_overlay") {
    const sub = p.patch as Record<string, unknown>;
    if (kind === "lower_third") patch = { lowerThird: sub as BroadcastOverlayPatch["lowerThird"] };
    else if (kind === "ticker") patch = { ticker: sub as BroadcastOverlayPatch["ticker"] };
    else if (kind === "cta_banner") patch = { ctaBanner: sub as BroadcastOverlayPatch["ctaBanner"] };
    else return { ok: false, errors: ["bad overlay kind"] };
  } else {
    return { ok: false, errors: ["not an overlay action"] };
  }

  const merged = mergeBroadcastOverlayPatch(overlay, patch);
  const v = validateBroadcastOverlayState({
    ...merged,
    updatedAt: now,
    updatedByUserId: overlay.updatedByUserId,
    broadcastSessionId: overlay.broadcastSessionId,
  });
  return v.ok ? { ok: true, state: v.state } : { ok: false, errors: v.errors };
}

export function buildCountdownRenderPayload(
  countdown: BroadcastCountdownConfig,
  nowIso: string,
  brandAccentFallback?: string
): BroadcastCountdownRenderPayload | null {
  if (!countdown.visible) return null;
  const position = countdown.position ?? "top_right";
  const accent = countdown.accentHex?.trim() || brandAccentFallback?.trim() || undefined;
  const label = countdown.label?.trim();

  let remainingSeconds = 0;
  let targetPassed = false;
  let displayTime = "00:00";

  if (countdown.targetTimeIso && isValidIsoDateTime(countdown.targetTimeIso)) {
    const end = Date.parse(countdown.targetTimeIso);
    const now = Date.parse(nowIso);
    const diffSec = Math.max(0, Math.floor((end - now) / 1000));
    remainingSeconds = diffSec;
    targetPassed = now >= end;
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    displayTime = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else {
    displayTime = "--:--";
  }

  return {
    visible: true,
    label,
    position,
    accentHex: accent,
    remainingSeconds,
    displayTime,
    targetPassed,
  };
}

export function mergeCountdownIntoRenderModel(
  model: BroadcastCompositorRenderModel,
  countdownPayload: BroadcastCountdownRenderPayload | null
): BroadcastCompositorRenderModel {
  if (!countdownPayload) return { ...model, countdown: undefined };
  return { ...model, countdown: countdownPayload };
}

/**
 * Apply `start_countdown` / `stop_countdown` scheduled actions (mutates schedule JSON only).
 */
export function applyCountdownAutomationAction(
  schedule: BroadcastScheduleState,
  action: BroadcastScheduledAction,
  nowIso: string,
  actorUserId: number
): { ok: true; state: BroadcastScheduleState } | { ok: false; errors: string[] } {
  if (action.actionType === "stop_countdown") {
    return {
      ok: true,
      state: {
        ...schedule,
        countdown: { ...schedule.countdown, visible: false },
        updatedAt: nowIso,
        updatedByUserId: actorUserId,
      },
    };
  }
  if (action.actionType !== "start_countdown") {
    return { ok: false, errors: ["not a countdown action"] };
  }
  const p = action.payload;
  const pos = p.position;
  if (
    pos !== undefined &&
    pos !== null &&
    pos !== "top_right" &&
    pos !== "top_center" &&
    pos !== "bottom_right"
  ) {
    return { ok: false, errors: ["invalid start_countdown.position"] };
  }
  const tt = p.targetTimeIso;
  if (typeof tt === "string" && tt.trim() && !isValidIsoDateTime(tt)) {
    return { ok: false, errors: ["invalid start_countdown.targetTimeIso"] };
  }
  const labelRaw = p.label;
  if (labelRaw !== undefined && labelRaw !== null) {
    if (typeof labelRaw !== "string" || labelRaw.length > COUNTDOWN_LABEL_MAX) {
      return { ok: false, errors: ["invalid start_countdown.label"] };
    }
  }
  if (p.accentHex !== undefined && p.accentHex !== null && !isHexAccent(p.accentHex)) {
    return { ok: false, errors: ["invalid start_countdown.accentHex"] };
  }

  const next: BroadcastCountdownConfig = {
    ...schedule.countdown,
    visible: typeof p.visible === "boolean" ? p.visible : true,
    targetTimeIso:
      typeof tt === "string" && tt.trim() && isValidIsoDateTime(tt)
        ? tt
        : schedule.countdown.targetTimeIso,
    label:
      typeof labelRaw === "string" && labelRaw.trim()
        ? labelRaw.trim().slice(0, COUNTDOWN_LABEL_MAX)
        : labelRaw === "" || labelRaw === null
          ? undefined
          : schedule.countdown.label,
    position: (pos as BroadcastCountdownConfig["position"]) ?? schedule.countdown.position ?? "top_right",
    accentHex:
      typeof p.accentHex === "string" && isHexAccent(p.accentHex)
        ? normalizeHex(p.accentHex)
        : p.accentHex === "" || p.accentHex === null
          ? undefined
          : schedule.countdown.accentHex,
  };

  return {
    ok: true,
    state: {
      ...schedule,
      countdown: next,
      updatedAt: nowIso,
      updatedByUserId: actorUserId,
    },
  };
}

export function buildScheduleSummaryForStatus(schedule: BroadcastScheduleState, nowIso: string) {
  const next = getNextScheduledAction(schedule, nowIso);
  return {
    automationEnabled: schedule.automationEnabled,
    countdownVisible: schedule.countdown.visible,
    countdownTargetIso: schedule.countdown.targetTimeIso ?? null,
    nextScheduledActionAt: next?.executeAtIso ?? null,
    nextScheduledActionType: next?.actionType ?? null,
    lastExecutedActionId: schedule.lastExecutedActionId ?? null,
    lastEvaluatedAt: schedule.lastEvaluatedAt ?? null,
  };
}

export function buildScheduleSummaryForRenderSession(schedule: BroadcastScheduleState, nowIso: string) {
  const s = buildScheduleSummaryForStatus(schedule, nowIso);
  return {
    automationEnabled: s.automationEnabled,
    countdownVisible: s.countdownVisible,
    nextScheduledActionAt: s.nextScheduledActionAt,
    lastExecutedActionId: s.lastExecutedActionId,
    lastEvaluatedAt: s.lastEvaluatedAt,
  };
}
