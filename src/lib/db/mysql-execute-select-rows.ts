/**
 * Normalize mysql2 / Drizzle `db.execute` SELECT results into row objects (Parts 55–56).
 * Driver may return `[rows, fields]` or a flat rows array depending on path.
 */
export function rowsFromMysqlExecute(executed: unknown): Record<string, unknown>[] {
  if (Array.isArray(executed) && executed.length > 0 && Array.isArray(executed[0])) {
    return executed[0] as Record<string, unknown>[];
  }
  if (Array.isArray(executed)) {
    return executed as Record<string, unknown>[];
  }
  return [];
}
