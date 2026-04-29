/**
 * Pure helpers for safe string prefills (no React / shared state).
 */

export type LaunchPrefillDecision = "apply" | "noop" | "confirm_replace";

/** Empty proposed → noop. Empty current → apply. Same trimmed → noop. Different → confirm_replace. */
export function decideStringPrefill(current: string, proposed: string): LaunchPrefillDecision {
  const c = current.trim();
  const p = proposed.trim();
  if (!p) return "noop";
  if (!c) return "apply";
  if (c === p) return "noop";
  return "confirm_replace";
}

export function normalizeForCompare(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}
