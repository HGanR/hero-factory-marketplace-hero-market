/**
 * Operator-facing projection for persisted Meta sync cooldown (Part 53).
 * Uses backoff rows from `paid-social-sync-backoff-state` — no duplicate cooldown rules.
 */

import { isAccountInPersistedCooldown, type PaidSocialSyncBackoffRow } from "@/lib/social/paid-social-sync-backoff-state";

export type PaidSyncCooldownProjection = {
  syncCooldownActive: boolean;
  syncCooldownUntil: string | null;
  /** Last failure category from backoff row when in cooldown (`throttled`, `auth_or_token`, etc.). */
  syncCooldownReason: string | null;
  syncCooldownLabel: string | null;
  syncCooldownHint: string | null;
};

const INACTIVE: PaidSyncCooldownProjection = {
  syncCooldownActive: false,
  syncCooldownUntil: null,
  syncCooldownReason: null,
  syncCooldownLabel: null,
  syncCooldownHint: null,
};

function reasonToOperatorCopy(reason: string | null): { reasonLine: string } {
  if (reason === "throttled") {
    return { reasonLine: "Last scheduled sync hit Meta rate limits for this ad account." };
  }
  if (reason === "auth_or_token") {
    return { reasonLine: "Last failure looked like a token or permissions issue for this ad account." };
  }
  if (reason) {
    return { reasonLine: `Last failure category: ${reason.replace(/_/g, " ")}.` };
  }
  return { reasonLine: "" };
}

/**
 * Map a backoff row to API/UI fields. Pass `null` when not in cooldown or row missing.
 */
export function projectPaidSyncCooldownFromBackoffRow(
  row: PaidSocialSyncBackoffRow | null | undefined,
  now: Date = new Date()
): PaidSyncCooldownProjection {
  if (!row || !isAccountInPersistedCooldown(row, now)) {
    return { ...INACTIVE };
  }

  const untilIso = row.backoffUntil ? new Date(row.backoffUntil).toISOString() : null;
  const reason = row.lastFailureCategory ? String(row.lastFailureCategory) : null;
  const { reasonLine } = reasonToOperatorCopy(reason);

  const label = "Meta sync paused (cooldown)";
  const hint = [
    `Automated scheduled sync for this ad account is deferred until ${untilIso ?? "cooldown ends"}.`,
    reasonLine,
    "Manual “Sync from Meta” may still be attempted if you need an immediate read.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    syncCooldownActive: true,
    syncCooldownUntil: untilIso,
    syncCooldownReason: reason,
    syncCooldownLabel: label,
    syncCooldownHint: hint,
  };
}
