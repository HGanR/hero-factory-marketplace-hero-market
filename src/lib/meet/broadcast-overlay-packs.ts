/**
 * Overlay preset packs — partial V2 overlay payloads merged on explicit apply.
 */

import type { BroadcastCtaBanner, BroadcastLowerThird, BroadcastOverlayPatch, BroadcastTicker } from "./broadcast-overlays";
import { isAllowedOverlayUrl, isHexAccent } from "./broadcast-overlays";

const HEADLINE_MAX = 120;
const SUBHEAD_MAX = 180;
const TICKER_MAX = 500;
const CTA_TEXT_MAX = 200;
const CTA_LABEL_MAX = 80;
const URL_MAX = 2048;

function trimStr(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function normAccent(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v !== "string" || !isHexAccent(v)) return undefined;
  const t = v.trim();
  return t.startsWith("#") ? t : `#${t}`;
}

function parseLowerThirdFragment(json: unknown): Partial<BroadcastLowerThird> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<BroadcastLowerThird> = {};
  if (typeof o.visible === "boolean") out.visible = o.visible;
  const h = trimStr(o.headline, HEADLINE_MAX);
  if (h) out.headline = h;
  const s = trimStr(o.subheadline, SUBHEAD_MAX);
  if (s) out.subheadline = s;
  if (o.position === "bottom_left" || o.position === "bottom_center") out.position = o.position;
  const a = normAccent(o.accentHex);
  if (a) out.accentHex = a;
  return out;
}

function parseTickerFragment(json: unknown): Partial<BroadcastTicker> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<BroadcastTicker> = {};
  if (typeof o.visible === "boolean") out.visible = o.visible;
  const t = trimStr(o.text, TICKER_MAX);
  if (t) out.text = t;
  if (o.speed === "slow" || o.speed === "normal") out.speed = o.speed;
  const a = normAccent(o.accentHex);
  if (a) out.accentHex = a;
  return out;
}

function parseCtaFragment(json: unknown): Partial<BroadcastCtaBanner> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<BroadcastCtaBanner> = {};
  if (typeof o.visible === "boolean") out.visible = o.visible;
  const tx = trimStr(o.text, CTA_TEXT_MAX);
  if (tx) out.text = tx;
  const bl = trimStr(o.buttonLabel, CTA_LABEL_MAX);
  if (bl) out.buttonLabel = bl;
  const url = trimStr(o.buttonUrl, URL_MAX);
  if (url && isAllowedOverlayUrl(url)) out.buttonUrl = url;
  if (o.position === "top" || o.position === "bottom") out.position = o.position;
  const a = normAccent(o.accentHex);
  if (a) out.accentHex = a;
  return out;
}

export type BroadcastOverlayPack = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  lowerThirdPresetJson: Record<string, unknown> | null;
  tickerPresetJson: Record<string, unknown> | null;
  ctaPresetJson: Record<string, unknown> | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type BroadcastOverlayPackInput = {
  name?: unknown;
  description?: unknown;
  lowerThirdPresetJson?: unknown;
  tickerPresetJson?: unknown;
  ctaPresetJson?: unknown;
};

export function validateBroadcastOverlayPack(
  input: BroadcastOverlayPackInput,
  mode: "create" | "patch"
): { ok: true; data: Partial<BroadcastOverlayPack> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const out: Partial<BroadcastOverlayPack> = {};
  if (mode === "create" || input.name !== undefined) {
    const n = typeof input.name === "string" ? input.name.trim() : "";
    if (!n) errors.push("name required");
    else out.name = n.slice(0, 160);
  }
  if (input.description !== undefined) {
    out.description = input.description === null ? null : typeof input.description === "string" ? input.description.slice(0, 2000) : null;
    if (input.description != null && typeof input.description !== "string") errors.push("description must be string");
  }
  for (const key of ["lowerThirdPresetJson", "tickerPresetJson", "ctaPresetJson"] as const) {
    if (input[key] !== undefined) {
      const v = input[key];
      if (v === null) {
        (out as Record<string, unknown>)[key] = null;
      } else if (v !== undefined && typeof v === "object" && !Array.isArray(v)) {
        (out as Record<string, unknown>)[key] = v as Record<string, unknown>;
      } else if (v !== undefined) {
        errors.push(`${key} must be object or null`);
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: out };
}

export function summarizeBroadcastOverlayPack(p: BroadcastOverlayPack): { id: number; name: string; hasLowerThird: boolean; hasTicker: boolean; hasCta: boolean } {
  return {
    id: p.id,
    name: p.name,
    hasLowerThird: p.lowerThirdPresetJson != null && Object.keys(p.lowerThirdPresetJson).length > 0,
    hasTicker: p.tickerPresetJson != null && Object.keys(p.tickerPresetJson).length > 0,
    hasCta: p.ctaPresetJson != null && Object.keys(p.ctaPresetJson).length > 0,
  };
}

/** Merge pack JSON into an overlay patch (operator explicit apply). */
export function buildOverlayPatchFromPack(pack: BroadcastOverlayPack): BroadcastOverlayPatch {
  const patch: BroadcastOverlayPatch = {};
  const lt = parseLowerThirdFragment(pack.lowerThirdPresetJson);
  if (lt && Object.keys(lt).length) patch.lowerThird = lt;
  const tk = parseTickerFragment(pack.tickerPresetJson);
  if (tk && Object.keys(tk).length) patch.ticker = tk;
  const cta = parseCtaFragment(pack.ctaPresetJson);
  if (cta && Object.keys(cta).length) patch.ctaBanner = cta;
  return patch;
}
