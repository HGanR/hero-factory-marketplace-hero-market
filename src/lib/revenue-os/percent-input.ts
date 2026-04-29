/**
 * Canonical conversion-rate semantics for Revenue OS:
 * - Stored values are **percent points** (1 = 1%, 2.5 = 2.5%, 25 = 25%).
 * - Revenue formulas use `(rate / 100)` consistently.
 *
 * User text rules:
 * - "1%", "2.5%", "0.8%" → strip `%` and use the number as percent points (never multiply).
 * - "2.5", "25", "1" → same numeric meaning (no hidden ×100).
 * - Reject values above 100 (percent points) or negative.
 */

export type ParsePercentResult =
  | { ok: true; percentPoints: number }
  | { ok: false; reason: "empty" | "invalid" | "over_max" };

/**
 * Parse a single user-supplied conversion rate string into percent points.
 */
export function parsePercentFromUserText(raw: string): ParsePercentResult {
  const t = raw.trim();
  if (!t) return { ok: false, reason: "empty" };

  const cleaned = t.replace(/[$,]/g, "").replace(/%/g, "").trim();
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: "invalid" };
  if (n > 100) return { ok: false, reason: "over_max" };

  return { ok: true, percentPoints: n };
}

/** Clamp a numeric percent-point value for APIs / shared state. */
export function clampPercentPoints(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
