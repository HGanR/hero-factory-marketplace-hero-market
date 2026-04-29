/**
 * Env-driven caps for scheduled paid Meta sync (Part 51). All values clamped server-side.
 */

export const SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD = 100;
export const SCHEDULED_PAID_META_SYNC_SCAN_POOL_HARD = 500;
export const SCHEDULED_PAID_META_SYNC_MAX_PER_ACCOUNT_HARD = 50;
export const SCHEDULED_PAID_META_SYNC_MAX_CAMPAIGNS_HARD = 100;
export const SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_HARD = 30;
export const SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_MIN = 1;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export type ScheduledPaidMetaSyncConfig = {
  maxItems: number;
  scanPoolLimit: number;
  maxPerAccount: number;
  maxCampaigns: number;
  throttlePauseAfter: number;
};

export function getScheduledPaidMetaSyncConfig(
  overrides?: Partial<ScheduledPaidMetaSyncConfig>
): ScheduledPaidMetaSyncConfig {
  const maxItems = Math.min(
    Math.max(overrides?.maxItems ?? parsePositiveInt(process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS, 15), 1),
    SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD
  );
  const scanPoolLimit = Math.min(
    Math.max(
      overrides?.scanPoolLimit ??
        parsePositiveInt(process.env.SCHEDULED_PAID_META_SYNC_SCAN_POOL_LIMIT, 120),
      10
    ),
    SCHEDULED_PAID_META_SYNC_SCAN_POOL_HARD
  );
  const maxPerAccount = Math.min(
    Math.max(
      overrides?.maxPerAccount ??
        parsePositiveInt(process.env.SCHEDULED_PAID_META_SYNC_MAX_PER_ACCOUNT, 8),
      1
    ),
    SCHEDULED_PAID_META_SYNC_MAX_PER_ACCOUNT_HARD
  );
  const maxCampaigns = Math.min(
    Math.max(
      overrides?.maxCampaigns ??
        parsePositiveInt(process.env.SCHEDULED_PAID_META_SYNC_MAX_CAMPAIGNS, 25),
      1
    ),
    SCHEDULED_PAID_META_SYNC_MAX_CAMPAIGNS_HARD
  );
  const throttlePauseAfter = Math.min(
    Math.max(
      overrides?.throttlePauseAfter ??
        parsePositiveInt(process.env.SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER, 2),
      SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_MIN
    ),
    SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_HARD
  );

  return { maxItems, scanPoolLimit, maxPerAccount, maxCampaigns, throttlePauseAfter };
}
