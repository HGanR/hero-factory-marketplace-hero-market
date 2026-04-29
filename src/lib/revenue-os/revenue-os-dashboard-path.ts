/**
 * Pure helpers for Revenue OS dashboard vs pipeline routes (signal enrichment scope).
 */

export function isRevenueOsDashboardPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.includes("/revenue-os/dashboard"));
}
