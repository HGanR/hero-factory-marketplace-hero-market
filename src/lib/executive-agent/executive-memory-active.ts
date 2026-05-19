/**
 * Pure helpers for executive memory visibility (safe in client tests).
 */

export function isExecutiveMemoryItemActive(
  row: { archivedAt: Date | null; expiresAt: Date | null },
  now = new Date()
): boolean {
  if (row.archivedAt != null) return false;
  if (row.expiresAt != null && row.expiresAt.getTime() < now.getTime()) return false;
  return true;
}
