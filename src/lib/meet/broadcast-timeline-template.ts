/**
 * Reusable run-of-show timeline: relative offsets from event wall-clock start → absolute schedule actions.
 */

import type { BroadcastCountdownConfig, BroadcastScheduleState, BroadcastScheduledAction } from "./broadcast-schedule";
import {
  BROADCAST_SCHEDULED_ACTION_TYPES,
  MAX_SCHEDULED_ACTIONS,
  validateBroadcastScheduleState,
  validateBroadcastScheduledActionPayload,
} from "./broadcast-schedule";
import type { BroadcastScheduledActionType } from "./broadcast-schedule";

export type BroadcastTimelineRelativeAction = {
  offsetMsFromEventStart: number;
  actionType: BroadcastScheduledActionType;
  payload: Record<string, unknown>;
  enabled?: boolean;
};

export type BroadcastTimelineTemplateBody = {
  countdown: {
    visible: boolean;
    /** Target time = eventStart + offset (ms). Default 0 = countdown to event start. */
    targetOffsetMsFromEventStart?: number;
    label?: string;
    position?: BroadcastCountdownConfig["position"];
    accentHex?: string;
  };
  relativeActions: BroadcastTimelineRelativeAction[];
  automationEnabled?: boolean;
};

const MAX_RELATIVE = MAX_SCHEDULED_ACTIONS;

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateBroadcastTimelineTemplate(
  input: unknown
): { ok: true; template: BroadcastTimelineTemplateBody } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input == null || typeof input !== "object") {
    return { ok: false, errors: ["template must be an object"] };
  }
  const o = input as Record<string, unknown>;
  const cd = o.countdown;
  if (cd == null || typeof cd !== "object") {
    errors.push("countdown is required");
    return { ok: false, errors };
  }
  const cdo = cd as Record<string, unknown>;
  if (typeof cdo.visible !== "boolean") errors.push("countdown.visible must be boolean");
  const pos = cdo.position;
  if (
    pos !== undefined &&
    pos !== "top_right" &&
    pos !== "top_center" &&
    pos !== "bottom_right"
  ) {
    errors.push("invalid countdown.position");
  }
  if (cdo.targetOffsetMsFromEventStart !== undefined && !isFiniteNum(cdo.targetOffsetMsFromEventStart)) {
    errors.push("invalid countdown.targetOffsetMsFromEventStart");
  }
  if (cdo.label !== undefined && cdo.label !== null && typeof cdo.label !== "string") {
    errors.push("invalid countdown.label");
  }
  if (cdo.accentHex !== undefined && cdo.accentHex !== null && typeof cdo.accentHex !== "string") {
    errors.push("invalid countdown.accentHex");
  }

  const rel = o.relativeActions;
  if (!Array.isArray(rel)) errors.push("relativeActions must be an array");
  else if (rel.length > MAX_RELATIVE) errors.push(`relativeActions max ${MAX_RELATIVE}`);

  if (errors.length) return { ok: false, errors };

  const relativeActions: BroadcastTimelineRelativeAction[] = [];
  for (let i = 0; i < (rel as unknown[]).length; i++) {
    const row = (rel as unknown[])[i];
    if (row == null || typeof row !== "object") {
      errors.push(`relativeActions[${i}] invalid`);
      continue;
    }
    const r = row as Record<string, unknown>;
    if (!isFiniteNum(r.offsetMsFromEventStart)) {
      errors.push(`relativeActions[${i}].offsetMsFromEventStart invalid`);
      continue;
    }
    const at = r.actionType;
    if (typeof at !== "string" || !BROADCAST_SCHEDULED_ACTION_TYPES.includes(at as BroadcastScheduledActionType)) {
      errors.push(`relativeActions[${i}].actionType invalid`);
      continue;
    }
    const pv = validateBroadcastScheduledActionPayload(at as BroadcastScheduledActionType, r.payload);
    if (!pv.ok) {
      errors.push(`relativeActions[${i}]: ${pv.errors.join("; ")}`);
      continue;
    }
    relativeActions.push({
      offsetMsFromEventStart: r.offsetMsFromEventStart as number,
      actionType: at as BroadcastScheduledActionType,
      payload: pv.payload,
      enabled: r.enabled === false ? false : true,
    });
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    template: {
      countdown: {
        visible: Boolean(cdo.visible),
        targetOffsetMsFromEventStart:
          cdo.targetOffsetMsFromEventStart !== undefined && isFiniteNum(cdo.targetOffsetMsFromEventStart)
            ? cdo.targetOffsetMsFromEventStart
            : 0,
        label: typeof cdo.label === "string" ? cdo.label.slice(0, 120) : undefined,
        position: (pos as BroadcastCountdownConfig["position"]) ?? "top_right",
        accentHex: typeof cdo.accentHex === "string" ? cdo.accentHex : undefined,
      },
      relativeActions,
      automationEnabled: o.automationEnabled === false ? false : true,
    },
  };
}

export function shiftTemplateTimesRelativeToEventStart(
  eventStartIso: string,
  template: BroadcastTimelineTemplateBody
): { targetTimeIso: string | undefined; actions: BroadcastScheduledAction[] } {
  const startMs = Date.parse(eventStartIso);
  const offsetTarget = template.countdown.targetOffsetMsFromEventStart ?? 0;
  const targetTimeIso = Number.isNaN(startMs)
    ? undefined
    : new Date(startMs + offsetTarget).toISOString();

  const actions: BroadcastScheduledAction[] = [];
  const sorted = [...template.relativeActions].sort((a, b) => a.offsetMsFromEventStart - b.offsetMsFromEventStart);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (r.enabled === false) continue;
    const atMs = startMs + r.offsetMsFromEventStart;
    if (Number.isNaN(atMs)) continue;
    actions.push({
      id: `timeline_${r.offsetMsFromEventStart}_${i}_${r.actionType}`.slice(0, 64),
      actionType: r.actionType,
      executeAtIso: new Date(atMs).toISOString(),
      payload: { ...r.payload },
      enabled: true,
    });
  }

  return { targetTimeIso, actions };
}

export function buildScheduleStateFromTimelineTemplate(params: {
  broadcastSessionId: number;
  userId: number;
  eventStartIso: string;
  template: BroadcastTimelineTemplateBody;
  nowIso: string;
}): { ok: true; state: BroadcastScheduleState } | { ok: false; errors: string[] } {
  const { targetTimeIso, actions } = shiftTemplateTimesRelativeToEventStart(params.eventStartIso, params.template);
  let accentHex: string | undefined;
  if (typeof params.template.countdown.accentHex === "string") {
    const x = params.template.countdown.accentHex.trim();
    if (/^#?[0-9A-Fa-f]{6}$/.test(x)) accentHex = x.startsWith("#") ? x : `#${x}`;
  }
  const countdown: BroadcastCountdownConfig = {
    visible: params.template.countdown.visible,
    position: params.template.countdown.position ?? "top_right",
    label: params.template.countdown.label,
    accentHex,
    targetTimeIso: params.template.countdown.visible ? targetTimeIso : undefined,
  };

  const draft: BroadcastScheduleState = {
    broadcastSessionId: params.broadcastSessionId,
    countdown,
    actions,
    automationEnabled: params.template.automationEnabled !== false,
    updatedAt: params.nowIso,
    updatedByUserId: params.userId,
  };

  const v = validateBroadcastScheduleState(draft);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ok: true, state: v.state };
}
