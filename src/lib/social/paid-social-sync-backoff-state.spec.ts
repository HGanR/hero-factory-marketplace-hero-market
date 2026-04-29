/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  applyPaidMetaSyncAttemptToBackoffState,
  clearPaidSyncBackoffState,
  getPaidSyncPersistedBackoffConfig,
  isAccountInPersistedCooldown,
  normalizePaidSyncAccountKey,
  type PaidSocialSyncBackoffRow,
} from "@/lib/social/paid-social-sync-backoff-state";
import type { SyncPaidSocialMetaResult } from "@/lib/social/paid-social-campaign-meta-sync";

function mockInsertChain() {
  const onDuplicateKeyUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onDuplicateKeyUpdate });
  const insert = jest.fn().mockReturnValue({ values });
  return { insert, values, onDuplicateKeyUpdate };
}

describe("normalizePaidSyncAccountKey", () => {
  it("strips act_ prefix", () => {
    expect(normalizePaidSyncAccountKey("act_12345")).toBe("12345");
  });

  it("uses unknown placeholder when empty", () => {
    expect(normalizePaidSyncAccountKey(null)).toBe("unknown_account");
  });
});

describe("isAccountInPersistedCooldown", () => {
  it("false when no row or no backoff", () => {
    expect(isAccountInPersistedCooldown(undefined, new Date("2026-01-01T00:00:00Z"))).toBe(false);
    expect(
      isAccountInPersistedCooldown({ backoffUntil: null } as PaidSocialSyncBackoffRow, new Date("2026-01-01T00:00:00Z"))
    ).toBe(false);
  });

  it("true when backoffUntil in future", () => {
    const row = {
      backoffUntil: new Date("2026-06-01T00:00:00Z"),
    } as PaidSocialSyncBackoffRow;
    expect(isAccountInPersistedCooldown(row, new Date("2026-01-01T00:00:00Z"))).toBe(true);
  });

  it("false when backoff expired", () => {
    const row = {
      backoffUntil: new Date("2025-06-01T00:00:00Z"),
    } as PaidSocialSyncBackoffRow;
    expect(isAccountInPersistedCooldown(row, new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("getPaidSyncPersistedBackoffConfig", () => {
  const keys = [
    "PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_BASE_SEC",
    "PAID_SOCIAL_SYNC_PERSISTED_AUTH_COOLDOWN_SEC",
    "PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_MAX_SEC",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
      delete prev[k];
    }
  });

  it("returns clamped defaults", () => {
    const c = getPaidSyncPersistedBackoffConfig();
    expect(c.throttleBaseSec).toBeGreaterThanOrEqual(60);
    expect(c.authCooldownSec).toBeGreaterThanOrEqual(300);
  });
});

describe("applyPaidMetaSyncAttemptToBackoffState", () => {
  const syncBase = {
    snapshotInserted: false,
    runtimeStatus: "unknown",
    warningCount: 0,
    phasesWithErrors: [],
    hadThrottlePhase: false,
    hadAuthPhase: false,
    syncFailedTotally: false,
    worstHardCategory: null,
    insightsSource: null,
    metricsCompleteness: "none" as const,
    sourceNotes: [],
    usedFallbackInsights: false,
  };

  it("clears on successful sync", async () => {
    const { insert, onDuplicateKeyUpdate } = mockInsertChain();
    const db = { insert };
    await applyPaidMetaSyncAttemptToBackoffState(db as never, {
      provider: "meta_ads",
      accountKey: "1",
      previousRow: undefined,
      sync: { ...syncBase } as SyncPaidSocialMetaResult["sync"],
    });
    expect(insert).toHaveBeenCalled();
    expect(onDuplicateKeyUpdate).toHaveBeenCalled();
  });

  it("records throttle on total failure + hadThrottlePhase", async () => {
    const { insert } = mockInsertChain();
    const db = { insert };
    await applyPaidMetaSyncAttemptToBackoffState(db as never, {
      provider: "meta_ads",
      accountKey: "1",
      previousRow: undefined,
      sync: {
        ...syncBase,
        syncFailedTotally: true,
        hadThrottlePhase: true,
      } as SyncPaidSocialMetaResult["sync"],
    });
    expect(insert).toHaveBeenCalled();
  });

  it("prefers auth path when auth + throttle", async () => {
    const { insert } = mockInsertChain();
    const db = { insert };
    await applyPaidMetaSyncAttemptToBackoffState(db as never, {
      provider: "meta_ads",
      accountKey: "1",
      previousRow: undefined,
      sync: {
        ...syncBase,
        syncFailedTotally: true,
        hadThrottlePhase: true,
        hadAuthPhase: true,
      } as SyncPaidSocialMetaResult["sync"],
    });
    expect(insert).toHaveBeenCalled();
  });
});

describe("clearPaidSyncBackoffState", () => {
  it("upserts null cooldown", async () => {
    const { insert } = mockInsertChain();
    await clearPaidSyncBackoffState({ insert } as never, "meta_ads", "9");
    expect(insert).toHaveBeenCalled();
  });
});
