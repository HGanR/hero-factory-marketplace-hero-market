export type TrendPoint = { label: string; value: number };

export function deriveWeeklySeries(total: number): TrendPoint[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (!Number.isFinite(total) || total <= 0) {
    return labels.map((label) => ({ label, value: 0 }));
  }
  const base = Math.max(1, Math.floor(total / 7));
  const rem = Math.max(0, total - base * 7);
  return labels.map((label, i) => ({ label, value: base + (i < rem ? 1 : 0) }));
}
