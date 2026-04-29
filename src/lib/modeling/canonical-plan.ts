import { createHash } from "crypto";
import type { BuildPlan } from "./prompt-schema";

const PRECISION = 4;

function roundNum(n: number): number {
  return Math.round(n * 10 ** PRECISION) / 10 ** PRECISION;
}

function canonicalizeValue(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val === "number") return roundNum(val);
  if (typeof val === "boolean" || typeof val === "string") return val;
  if (Array.isArray(val)) return val.map(canonicalizeValue).filter((v) => v !== undefined);
  if (typeof val === "object") return canonicalizeObj(val as Record<string, unknown>);
  return val;
}

function canonicalizeObj(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  for (const k of keys) {
    const v = canonicalizeValue(obj[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Produces a deterministic JSON representation of a build plan.
 * - Keys sorted alphabetically
 * - undefined removed
 * - Numbers rounded to 4 decimal places
 * Use for deduplication, provenance, and future timestamping.
 */
export function canonicalizePlan(plan: BuildPlan | Record<string, unknown>): Record<string, unknown> {
  return canonicalizeObj(plan as Record<string, unknown>);
}

/**
 * Returns sha256 hex of canonical JSON for the plan.
 */
export function hashPlan(plan: BuildPlan | Record<string, unknown>): string {
  const canonical = canonicalizePlan(plan);
  const json = JSON.stringify(canonical);
  return createHash("sha256").update(json, "utf8").digest("hex");
}
