/**
 * Env-tunable thresholds for paid optimization signals (Part 54).
 * All values are clamped server-side; defaults match Part 53 behavior.
 */

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function clampFloat(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseEnvInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return clampInt(n, min, max, fallback);
}

function parseEnvFloat(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseFloat(raw.trim());
  return clampFloat(n, min, max, fallback);
}

/** Default: 0.003 (0.3% CTR as decimal fraction, consistent with Meta-style CTR fields). */
export const PAID_SOCIAL_LOW_CTR_THRESHOLD_DEFAULT = 0.003;
/** Default: minimum impressions before CTR is evaluated. */
export const PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_DEFAULT = 200;
/**
 * Minimum reported spend (minor currency units) to flag spend_without_clicks.
 * Default 1 = any positive spend; raise to reduce noise from tiny rounding.
 */
export const PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_DEFAULT = 1;

export const PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV = "PAID_SOCIAL_LOW_CTR_THRESHOLD" as const;
export const PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV = "PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS" as const;
export const PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV = "PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR" as const;

export type PaidSocialOptimizationSignalConfig = {
  /** CTR below this (fraction, e.g. 0.01 = 1%) triggers low_ctr when impressions are sufficient. */
  lowCtrThreshold: number;
  lowCtrMinImpressions: number;
  /** Spend must be >= this (minor units) and clicks === 0 for spend_without_clicks. */
  spendWithoutClicksMinSpendMinor: number;
};

const LOW_CTR_THRESHOLD_MIN = 0.000_05;
const LOW_CTR_THRESHOLD_MAX = 0.5;
const LOW_CTR_IMPRESSIONS_MIN = 1;
const LOW_CTR_IMPRESSIONS_MAX = 1_000_000;
const SPEND_MINOR_MIN = 1;
const SPEND_MINOR_MAX = 1_000_000_000;

export function getPaidSocialOptimizationSignalConfig(): PaidSocialOptimizationSignalConfig {
  return {
    lowCtrThreshold: parseEnvFloat(
      process.env[PAID_SOCIAL_LOW_CTR_THRESHOLD_ENV],
      PAID_SOCIAL_LOW_CTR_THRESHOLD_DEFAULT,
      LOW_CTR_THRESHOLD_MIN,
      LOW_CTR_THRESHOLD_MAX
    ),
    lowCtrMinImpressions: parseEnvInt(
      process.env[PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_ENV],
      PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS_DEFAULT,
      LOW_CTR_IMPRESSIONS_MIN,
      LOW_CTR_IMPRESSIONS_MAX
    ),
    spendWithoutClicksMinSpendMinor: parseEnvInt(
      process.env[PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_ENV],
      PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR_DEFAULT,
      SPEND_MINOR_MIN,
      SPEND_MINOR_MAX
    ),
  };
}
