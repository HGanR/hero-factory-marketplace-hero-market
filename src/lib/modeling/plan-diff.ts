export type DiffChange = { path: string; prev: unknown; next: unknown };

/**
 * Shallow diff of two plan-like objects. Returns human-readable changes.
 */
export function diffPlans(prev: Record<string, unknown>, next: Record<string, unknown>): DiffChange[] {
  const changes: DiffChange[] = [];
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    const p = prev[key];
    const n = next[key];
    if (JSON.stringify(p) === JSON.stringify(n)) continue;
    changes.push({ path: key, prev: p, next: n });
  }

  return changes;
}

/**
 * Format diff for display (e.g. "w: 10m → 12m")
 */
export function formatDiffChange(change: DiffChange, unit = "m"): string {
  const { path, prev, next } = change;
  const p = prev != null ? String(prev) : "—";
  const n = next != null ? String(next) : "—";
  const suffix = ["w", "d", "h", "wallThickness"].includes(path) ? unit : "";
  return `${path}: ${p}${suffix} → ${n}${suffix}`;
}
