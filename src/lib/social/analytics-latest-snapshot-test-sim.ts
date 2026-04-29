/**
 * Test-only helper: mirrors SQL
 * `ROW_NUMBER() OVER (PARTITION BY partitionCol ORDER BY fetched_at DESC, id DESC) WHERE rn = 1`
 * using string compare on `fetchedAt` (ISO-8601) and `id` (varchar), matching MySQL/TiDB ordering
 * for typical snapshot rows. Used for integration-style confidence tests (Part 57).
 */
export function simulateLatestSnapshotRowsPerPartition<
  T extends Record<string, unknown> & { id: string },
>(rows: T[], partitionKey: keyof T, fetchedAtKey: keyof T): T[] {
  const byPart = new Map<string, T[]>();
  for (const row of rows) {
    const k = String(row[partitionKey]);
    const list = byPart.get(k);
    if (list) list.push(row);
    else byPart.set(k, [row]);
  }
  const winners: T[] = [];
  for (const group of byPart.values()) {
    group.sort((a, b) => {
      const fa = String(a[fetchedAtKey]);
      const fb = String(b[fetchedAtKey]);
      if (fa !== fb) return fb.localeCompare(fa);
      return b.id.localeCompare(a.id);
    });
    winners.push(group[0]!);
  }
  return winners;
}
