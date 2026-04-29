import { z } from "zod";
import { BuildPlanSchema, type BuildPlan, DIM_MAX_METERS, type BuildPlanKind } from "./prompt-schema";

/** ft to m conversion */
const FT_TO_M = 0.3048;

function clampDim(v: number): number {
  return Math.max(0.1, Math.min(DIM_MAX_METERS, v));
}

export interface ParseResult {
  plan: BuildPlan;
  assumptions: string[];
  /** If prompt also requests an asset (e.g. "conference room with pine tree"), suggest loading it */
  suggestedAsset?: { name: string; assetUri: string };
  /** Parametric-first composition suggestion */
  suggestedObject?: {
    kind: Exclude<BuildPlanKind, "scene">;
    placement: { mode: "auto"; anchor: "center" | "near_wall" | "on_table" | "near_door" };
  };
}

const OFFICE_HQ_SYNONYMS =
  /family\s*office|office\s*hq|family\s*hq|headquarters|hq\s*office|headquarters|hq\b|family\s*office\s*building/i;
const VAULT_SYNONYMS = /vault|safe\s*room|secure\s*room|strongroom/i;
const CONFERENCE_SYNONYMS = /conference|meeting\s*room|board\s*room|war\s*room|meeting\s*space/i;
const PODIUM_SYNONYMS =
  /podium|plinth|pedestal|lectern|certificate\s*stand|display\s*stand/i;
const ROOM_SYNONYMS = /room|space|office|chamber|hall|floor\s*plan/i;

/**
 * Extract dimensions from prompt. Returns values in meters.
 * Matches: "20x30", "20 x 30", "20ft by 30ft", "12m x 10m", "20 30", "meters", "feet"
 */
function extractDimensions(
  prompt: string
): { w: number; d: number; h?: number; fromFt: boolean } | null {
  const raw = prompt;

  // Explicit units: "12m x 10m" or "20ft by 30ft"
  const mMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\s*(?:m|meters?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\s*(?:m|meters?))?/i);
  if (mMatch) {
    return {
      w: clampDim(parseFloat(mMatch[1]!)),
      d: clampDim(parseFloat(mMatch[2]!)),
      h: mMatch[3] ? clampDim(parseFloat(mMatch[3])) : undefined,
      fromFt: false,
    };
  }

  const ftMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|')\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?)?/i);
  if (ftMatch) {
    return {
      w: clampDim(parseFloat(ftMatch[1]!) * FT_TO_M),
      d: clampDim(parseFloat(ftMatch[2]!) * FT_TO_M),
      h: ftMatch[3] ? clampDim(parseFloat(ftMatch[3]) * FT_TO_M) : undefined,
      fromFt: true,
    };
  }

  // "W x D" or "W x D x H" (assume meters if no unit)
  const pairMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/);
  if (pairMatch) {
    const inFt = /\d+\s*(?:ft|feet|')/i.test(raw);
    const mult = inFt ? FT_TO_M : 1;
    return {
      w: clampDim(parseFloat(pairMatch[1]!) * mult),
      d: clampDim(parseFloat(pairMatch[2]!) * mult),
      h: pairMatch[3] ? clampDim(parseFloat(pairMatch[3]) * mult) : undefined,
      fromFt: inFt,
    };
  }

  return null;
}

/** Extract floors: "two floors", "2-story", "3 storey" */
function extractFloors(prompt: string): number | undefined {
  const lower = prompt.toLowerCase();
  if (/(?:2|two|double)\s*(?:floor|story|stories|storey|storeys)/i.test(lower)) return 2;
  if (/(?:3|three)\s*(?:floor|story|stories|storey|storeys)/i.test(lower)) return 3;
  if (/(?:4|four)\s*(?:floor|story|stories|storey|storeys)/i.test(lower)) return 4;
  const m = lower.match(/(\d+)\s*[-]?\s*(?:floor|story|storey)/i);
  if (m) return Math.min(4, Math.max(1, parseInt(m[1]!, 10)));
  return undefined;
}

/** Deterministic seed from prompt string */
function hashSeed(prompt: string): number {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) {
    h = Math.imul(31, h) + prompt.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Check if prompt also requests an asset (e.g. "with pine tree") */
function extractSuggestedAsset(prompt: string): { name: string; assetUri: string } | undefined {
  const lower = prompt.toLowerCase();
  const treeMatch = lower.match(/(?:with|and|plus)\s*(pine|oak|birch|maple|willow)\s*tree/i);
  if (treeMatch) {
    const t = treeMatch[1]!.toLowerCase();
    const name = t.charAt(0).toUpperCase() + t.slice(1) + " Tree";
    const file = `tree_${t}.glb`;
    return { name, assetUri: `/models/scenery/${file}` };
  }
  if (/with\s*(?:a\s*)?building/i.test(lower)) {
    return { name: "Building", assetUri: "/models/generated/building.glb" };
  }
  return undefined;
}

function extractSuggestedObject(prompt: string): ParseResult["suggestedObject"] | undefined {
  const lower = prompt.toLowerCase();
  if (!/(?:\bwith\b|\band\b|\bplus\b)/i.test(lower)) return undefined;

  if (/\bpodium|plinth|pedestal|lectern|certificate\s*stand|display\s*stand\b/i.test(lower)) {
    return {
      kind: "podium",
      placement: { mode: "auto", anchor: "near_wall" },
    };
  }
  if (/\bvault|safe\s*room|strongroom\b/i.test(lower)) {
    return {
      kind: "vault_room",
      placement: { mode: "auto", anchor: "near_door" },
    };
  }
  if (/\bconference|meeting\s*room|board\s*room\b/i.test(lower)) {
    return {
      kind: "conference_room",
      placement: { mode: "auto", anchor: "center" },
    };
  }
  return undefined;
}

/**
 * Rules-based prompt parser. No LLM required.
 * Plans always have version: 1 and optional seed. Dimensions in meters.
 */
export function parsePrompt(prompt: string): ParseResult {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  const assumptions: string[] = [];
  const dims = extractDimensions(prompt);
  const suggestedAsset = extractSuggestedAsset(prompt);
  const suggestedObject = extractSuggestedObject(prompt);

  // --- office_hq ---
  if (OFFICE_HQ_SYNONYMS.test(trimmed)) {
    const floors = extractFloors(prompt) ?? 1;
    const footprint = dims ? { w: dims.w, d: dims.d } : { w: 12, d: 10 };
    const plan: BuildPlan = {
      version: 1,
      kind: "office_hq",
      floors,
      footprint,
      rooms: [],
      style: /classic|traditional|conservative/i.test(lower) ? "classic" : "modern",
      seed: hashSeed(trimmed),
    };
    if (CONFERENCE_SYNONYMS.test(trimmed)) plan.rooms.push("conference");
    if (VAULT_SYNONYMS.test(trimmed)) plan.rooms.push("vault");
    if (/reception|receive/i.test(lower)) plan.rooms.push("reception");
    if (plan.rooms.length === 0) plan.rooms = ["reception", "conference", "vault"];
    if (!dims) assumptions.push("No dimensions provided: defaulted to 12m x 10m footprint.");
    else if (dims.fromFt) assumptions.push("Converted feet to meters.");
    return { plan, assumptions, suggestedAsset, suggestedObject };
  }

  // --- vault_room ---
  if (VAULT_SYNONYMS.test(trimmed)) {
    const w = dims?.w ?? 4;
    const d = dims?.d ?? 4;
    const maxWall = Math.min(w, d) / 2 - 0.01;
    const wallThickness = Math.min(0.4, maxWall);
    const plan: BuildPlan = {
      version: 1,
      kind: "vault_room",
      w,
      d,
      h: dims?.h ?? 3,
      wallThickness,
      hasTable: !/no\s*table|without\s*table/i.test(lower),
      style: "classic",
      seed: hashSeed(trimmed),
    };
    if (!dims) assumptions.push("No dimensions: defaulted to 4m x 4m x 3m.");
    else if (dims.fromFt) assumptions.push("Converted feet to meters.");
    return { plan, assumptions, suggestedAsset, suggestedObject };
  }

  // --- conference_room ---
  if (CONFERENCE_SYNONYMS.test(trimmed)) {
    const seatsMatch = lower.match(/(\d+)\s*seats?|(?:seat|fit)\s*(\d+)/i);
    const tableSeats = seatsMatch ? parseInt(seatsMatch[1] ?? seatsMatch[2]!, 10) : 8;
    const plan: BuildPlan = {
      version: 1,
      kind: "conference_room",
      w: dims?.w ?? 6,
      d: dims?.d ?? 5,
      h: dims?.h ?? 3,
      tableSeats: Math.min(40, Math.max(2, tableSeats)),
      style: /classic/i.test(lower) ? "classic" : "modern",
      seed: hashSeed(trimmed),
    };
    if (!dims) assumptions.push("No dimensions: defaulted to 6m x 5m x 3m.");
    else if (dims.fromFt) assumptions.push("Converted feet to meters.");
    return { plan, assumptions, suggestedAsset, suggestedObject };
  }

  // --- podium ---
  if (PODIUM_SYNONYMS.test(trimmed)) {
    const plan: BuildPlan = {
      version: 1,
      kind: "podium",
      w: dims ? clampDim(dims.w) : 0.6,
      d: dims ? clampDim(dims.d) : 0.4,
      h: dims?.h ?? 1.1,
      hasPlaque: !/no\s*plaque|without\s*plaque/i.test(lower),
      style: /modern|minimal/i.test(lower) ? "modern" : "classic",
      seed: hashSeed(trimmed),
    };
    if (!dims) assumptions.push("No dimensions: defaulted to 0.6m x 0.4m x 1.1m.");
    return { plan, assumptions, suggestedAsset, suggestedObject };
  }

  // --- room ---
  if (ROOM_SYNONYMS.test(trimmed) || /^\d+\s*(?:x|by|×)\s*\d+/i.test(trimmed)) {
    const doorMatch = lower.match(/(\d+)\s*doors?/i);
    const windowMatch = lower.match(/(\d+)\s*windows?/i);
    const doors = Math.min(20, Math.max(0, doorMatch ? parseInt(doorMatch[1]!, 10) : 1));
    const windows = Math.min(20, Math.max(0, windowMatch ? parseInt(windowMatch[1]!, 10) : 2));
    const plan: BuildPlan = {
      version: 1,
      kind: "room",
      w: dims?.w ?? 8,
      d: dims?.d ?? 6,
      h: dims?.h ?? 3,
      doors,
      windows,
      style: /classic|traditional/i.test(lower) ? "classic" : "modern",
      seed: hashSeed(trimmed),
    };
    if (!dims) assumptions.push("No dimensions: defaulted to 8m x 6m x 3m.");
    else if (dims.fromFt) assumptions.push("Converted feet to meters.");
    return { plan, assumptions, suggestedAsset, suggestedObject };
  }

  // Fallback: generic room
  const plan: BuildPlan = {
    version: 1,
    kind: "room",
    w: dims ? clampDim(dims.w) : 8,
    d: dims ? clampDim(dims.d) : 6,
    h: dims?.h ?? 3,
    doors: 1,
    windows: 2,
    style: "modern",
    seed: hashSeed(trimmed),
  };
  assumptions.push(
    "Unrecognized prompt: created a generic room. Try 'family office HQ', 'conference room', 'vault room', or 'podium'."
  );
  return { plan, assumptions };
}

/**
 * Validate and coerce a raw plan object. Throws ZodError on invalid plans.
 */
export function validatePlan(raw: unknown): BuildPlan {
  return BuildPlanSchema.parse(raw) as BuildPlan;
}
