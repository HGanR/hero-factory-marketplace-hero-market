/**
 * Cross-run paid Meta sync cooldown per provider + ad account (Part 52).
 * Complements within-run throttle pause in `run-scheduled-paid-social-meta-sync`.
 */

import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { paidSocialSyncBackoffState } from "@/lib/db/schema";
import type { PaidMetaSyncFailureCategory } from "@/lib/social/paid-social-meta-sync-failure-policy";
import type { SyncPaidSocialMetaResult } from "@/lib/social/paid-social-campaign-meta-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const PAID_SYNC_PROVIDER_META_ADS = "meta_ads" as const;

export type PaidSocialSyncBackoffRow = typeof paidSocialSyncBackoffState.$inferSelect;

export function normalizePaidSyncAccountKey(raw: string | null | undefined): string {
  const t = (raw ?? "").replace(/^act_/i, "").trim();
  return t || "unknown_account";
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export type PaidSyncPersistedBackoffConfig = {
  /** Base seconds for first throttle streak step (scaled by streak). */
  throttleBaseSec: number;
  /** Cooldown after auth-related sync failure. */
  authCooldownSec: number;
  /** Cap for throttle-derived cooldown. */
  maxThrottleCooldownSec: number;
};

export function getPaidSyncPersistedBackoffConfig(): PaidSyncPersistedBackoffConfig {
  const throttleBaseSec = Math.min(
    Math.max(parsePositiveInt(process.env.PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_BASE_SEC, 600), 60),
    86_400
  );
  const authCooldownSec = Math.min(
    Math.max(parsePositiveInt(process.env.PAID_SOCIAL_SYNC_PERSISTED_AUTH_COOLDOWN_SEC, 7200), 300),
    172_800
  );
  const maxThrottleCooldownSec = Math.min(
    Math.max(parsePositiveInt(process.env.PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_MAX_SEC, 28_800), throttleBaseSec),
    172_800
  );
  return { throttleBaseSec, authCooldownSec, maxThrottleCooldownSec };
}

function throttleCooldownSeconds(streak: number, cfg: PaidSyncPersistedBackoffConfig): number {
  const s = Math.max(1, streak);
  const exp = Math.min(s - 1, 6);
  const raw = cfg.throttleBaseSec * 2 ** exp;
  return Math.min(Math.round(raw), cfg.maxThrottleCooldownSec);
}

export function isAccountInPersistedCooldown(row: PaidSocialSyncBackoffRow | null | undefined, now: Date): boolean {
  if (!row?.backoffUntil) return false;
  return row.backoffUntil.getTime() > now.getTime();
}

export async function reloadPaidSyncBackoffRow(
  db: Db,
  provider: string,
  accountKey: string
): Promise<PaidSocialSyncBackoffRow | null> {
  const [r] = await db
    .select()
    .from(paidSocialSyncBackoffState)
    .where(and(eq(paidSocialSyncBackoffState.provider, provider), eq(paidSocialSyncBackoffState.accountKey, accountKey)))
    .limit(1);
  return r ?? null;
}

export async function loadPaidSyncBackoffStatesForAccounts(
  db: Db,
  provider: string,
  accountKeys: string[]
): Promise<Map<string, PaidSocialSyncBackoffRow>> {
  const uniq = Array.from(new Set(accountKeys.filter(Boolean)));
  const out = new Map<string, PaidSocialSyncBackoffRow>();
  if (uniq.length === 0) return out;

  const rows = await db
    .select()
    .from(paidSocialSyncBackoffState)
    .where(and(eq(paidSocialSyncBackoffState.provider, provider), inArray(paidSocialSyncBackoffState.accountKey, uniq)));

  for (const r of rows) {
    out.set(r.accountKey, r);
  }
  return out;
}

async function upsertRow(
  db: Db,
  values: {
    id: string;
    provider: string;
    accountKey: string;
    backoffUntil: Date | null;
    lastFailureCategory: string | null;
    consecutiveThrottleCount: number;
    lastFailureAt: Date | null;
  }
): Promise<void> {
  await db
    .insert(paidSocialSyncBackoffState)
    .values({
      id: values.id,
      provider: values.provider,
      accountKey: values.accountKey,
      backoffUntil: values.backoffUntil,
      lastFailureCategory: values.lastFailureCategory,
      consecutiveThrottleCount: values.consecutiveThrottleCount,
      lastFailureAt: values.lastFailureAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        backoffUntil: values.backoffUntil,
        lastFailureCategory: values.lastFailureCategory,
        consecutiveThrottleCount: values.consecutiveThrottleCount,
        lastFailureAt: values.lastFailureAt,
        updatedAt: new Date(),
      },
    });
}

/** Clear cooldown after a successful or partially successful sync (no total failure). */
export async function clearPaidSyncBackoffState(db: Db, provider: string, accountKey: string): Promise<void> {
  const id = crypto.randomUUID();
  await upsertRow(db, {
    id,
    provider,
    accountKey,
    backoffUntil: null,
    lastFailureCategory: null,
    consecutiveThrottleCount: 0,
    lastFailureAt: null,
  });
}

async function recordThrottleBackoff(db: Db, provider: string, accountKey: string, prev: PaidSocialSyncBackoffRow | undefined): Promise<void> {
  const cfg = getPaidSyncPersistedBackoffConfig();
  const nextStreak = (prev?.consecutiveThrottleCount ?? 0) + 1;
  const sec = throttleCooldownSeconds(nextStreak, cfg);
  const until = new Date(Date.now() + sec * 1000);
  const id = prev?.id ?? crypto.randomUUID();
  await upsertRow(db, {
    id,
    provider,
    accountKey,
    backoffUntil: until,
    lastFailureCategory: "throttled",
    consecutiveThrottleCount: nextStreak,
    lastFailureAt: new Date(),
  });
}

async function recordAuthBackoff(db: Db, provider: string, accountKey: string, prev: PaidSocialSyncBackoffRow | undefined): Promise<void> {
  const cfg = getPaidSyncPersistedBackoffConfig();
  const until = new Date(Date.now() + cfg.authCooldownSec * 1000);
  const id = prev?.id ?? crypto.randomUUID();
  await upsertRow(db, {
    id,
    provider,
    accountKey,
    backoffUntil: until,
    lastFailureCategory: "auth_or_token",
    consecutiveThrottleCount: 0,
    lastFailureAt: new Date(),
  });
}

/**
 * Update persisted backoff from a scheduled sync attempt. Call once per attempted row after `syncPaidSocialMetaCampaign` returns.
 */
export async function applyPaidMetaSyncAttemptToBackoffState(
  db: Db,
  args: {
    provider: string;
    accountKey: string;
    previousRow: PaidSocialSyncBackoffRow | undefined;
    sync: SyncPaidSocialMetaResult["sync"];
  }
): Promise<void> {
  const { sync } = args;
  if (!sync.syncFailedTotally) {
    await clearPaidSyncBackoffState(db, args.provider, args.accountKey);
    return;
  }
  if (sync.hadAuthPhase) {
    await recordAuthBackoff(db, args.provider, args.accountKey, args.previousRow);
    return;
  }
  if (sync.hadThrottlePhase) {
    await recordThrottleBackoff(db, args.provider, args.accountKey, args.previousRow);
    return;
  }
}

export function summarizeBackoffForAudit(row: PaidSocialSyncBackoffRow | undefined): {
  inCooldown: boolean;
  backoffUntilIso: string | null;
  lastFailureCategory: PaidMetaSyncFailureCategory | string | null;
  consecutiveThrottleCount: number;
} {
  const now = new Date();
  const inCooldown = isAccountInPersistedCooldown(row, now);
  return {
    inCooldown,
    backoffUntilIso: row?.backoffUntil ? new Date(row.backoffUntil).toISOString() : null,
    lastFailureCategory: row?.lastFailureCategory ?? null,
    consecutiveThrottleCount: row?.consecutiveThrottleCount ?? 0,
  };
}
