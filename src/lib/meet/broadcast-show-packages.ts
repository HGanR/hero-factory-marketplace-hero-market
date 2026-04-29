/**
 * Reusable show packages — bundle launch defaults without removing explicit overrides.
 */

import type { BroadcastEvent } from "./broadcast-events";

export type BroadcastShowPackage = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  scenePresetId: number | null;
  timelineTemplateId: number | null;
  defaultBrandingJson: Record<string, unknown> | null;
  defaultOverlayPackId: number | null;
  defaultGuestCardPackId: number | null;
  defaultRoomId: string | null;
  isDefault: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

export type BroadcastShowPackageInput = {
  name?: unknown;
  description?: unknown;
  scenePresetId?: unknown;
  timelineTemplateId?: unknown;
  defaultBrandingJson?: unknown;
  defaultOverlayPackId?: unknown;
  defaultGuestCardPackId?: unknown;
  defaultRoomId?: unknown;
  isDefault?: unknown;
};

export type BroadcastShowPackageSummary = {
  id: number;
  name: string;
  scenePresetId: number | null;
  timelineTemplateId: number | null;
  defaultOverlayPackId: number | null;
  defaultGuestCardPackId: number | null;
  defaultRoomId: string | null;
  isDefault: boolean;
};

export type LaunchDefaultsFromPackage = {
  roomId: string | null;
  scenePresetId: number | null;
  timelineTemplateId: number | null;
  defaultBrandingJson: Record<string, unknown> | null;
  defaultOverlayPackId: number | null;
  defaultGuestCardPackId: number | null;
};

const ROOM_MAX = 256;

export function validateBroadcastShowPackage(
  input: BroadcastShowPackageInput,
  mode: "create" | "patch"
): { ok: true; data: Partial<BroadcastShowPackage> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const out: Partial<BroadcastShowPackage> = {};

  if (mode === "create" || input.name !== undefined) {
    const n = typeof input.name === "string" ? input.name.trim() : "";
    if (!n) errors.push("name required");
    else out.name = n.slice(0, 160);
  }

  if (input.description !== undefined) {
    out.description =
      input.description === null ? null : typeof input.description === "string" ? input.description.slice(0, 2000) : null;
    if (input.description != null && typeof input.description !== "string") errors.push("description must be string");
  }

  for (const key of ["scenePresetId", "timelineTemplateId", "defaultOverlayPackId", "defaultGuestCardPackId"] as const) {
    if (input[key] !== undefined) {
      const v = input[key];
      if (v === null) (out as Record<string, unknown>)[key] = null;
      else if (typeof v === "number" && Number.isFinite(v) && v > 0) (out as Record<string, unknown>)[key] = Math.floor(v);
      else if (typeof v === "string" && Number.isFinite(Number(v)) && Number(v) > 0)
        (out as Record<string, unknown>)[key] = Math.floor(Number(v));
      else errors.push(`invalid ${key}`);
    }
  }

  if (input.defaultRoomId !== undefined) {
    if (input.defaultRoomId === null || input.defaultRoomId === "") out.defaultRoomId = null;
    else if (typeof input.defaultRoomId === "string") out.defaultRoomId = input.defaultRoomId.trim().slice(0, ROOM_MAX);
    else errors.push("invalid defaultRoomId");
  }

  if (input.defaultBrandingJson !== undefined) {
    if (input.defaultBrandingJson === null) out.defaultBrandingJson = null;
    else if (typeof input.defaultBrandingJson === "object" && !Array.isArray(input.defaultBrandingJson)) {
      out.defaultBrandingJson = input.defaultBrandingJson as Record<string, unknown>;
    } else errors.push("defaultBrandingJson must be object or null");
  }

  if (input.isDefault !== undefined) {
    out.isDefault = Boolean(input.isDefault);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: out };
}

export function summarizeBroadcastShowPackage(p: BroadcastShowPackage): BroadcastShowPackageSummary {
  return {
    id: p.id,
    name: p.name,
    scenePresetId: p.scenePresetId,
    timelineTemplateId: p.timelineTemplateId,
    defaultOverlayPackId: p.defaultOverlayPackId,
    defaultGuestCardPackId: p.defaultGuestCardPackId,
    defaultRoomId: p.defaultRoomId,
    isDefault: p.isDefault,
  };
}

export function buildLaunchDefaultsFromShowPackage(pkg: BroadcastShowPackage | null): LaunchDefaultsFromPackage | null {
  if (!pkg) return null;
  return {
    roomId: pkg.defaultRoomId?.trim() || null,
    scenePresetId: pkg.scenePresetId,
    timelineTemplateId: pkg.timelineTemplateId,
    defaultBrandingJson: pkg.defaultBrandingJson,
    defaultOverlayPackId: pkg.defaultOverlayPackId,
    defaultGuestCardPackId: pkg.defaultGuestCardPackId,
  };
}

/** Merge resolution order: explicit overrides > event fields > package defaults. */
export function resolveEffectiveLaunchFields(params: {
  event: BroadcastEvent;
  packageDefaults: LaunchDefaultsFromPackage | null;
  overrides?: {
    roomId?: string | null;
    scenePresetId?: number | null;
    defaultTimelineTemplateId?: number | null;
  };
}): {
  roomId: string | null;
  scenePresetId: number | null;
  defaultTimelineTemplateId: number | null;
} {
  const { event, packageDefaults, overrides } = params;
  const room =
    overrides?.roomId !== undefined
      ? overrides.roomId
      : event.roomId?.trim()
        ? event.roomId
        : packageDefaults?.roomId ?? null;
  const scene =
    overrides?.scenePresetId !== undefined
      ? overrides.scenePresetId
      : event.scenePresetId ?? packageDefaults?.scenePresetId ?? null;
  const tpl =
    overrides?.defaultTimelineTemplateId !== undefined
      ? overrides.defaultTimelineTemplateId
      : event.defaultTimelineTemplateId ?? packageDefaults?.timelineTemplateId ?? null;

  return {
    roomId: room?.trim() || null,
    scenePresetId: scene != null && Number.isFinite(Number(scene)) ? Number(scene) : null,
    defaultTimelineTemplateId: tpl != null && Number.isFinite(Number(tpl)) ? Number(tpl) : null,
  };
}

export type OverlayPackSummaryPayload = {
  id: number;
  name: string;
  hasLowerThird: boolean;
  hasTicker: boolean;
  hasCta: boolean;
};
export type GuestCardPackSummaryPayload = { id: number; name: string; cardCount: number };
