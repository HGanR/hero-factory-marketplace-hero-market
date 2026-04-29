/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { loadPaidSyncCooldownProjectionsForAccountKeys } from "@/lib/social/paid-social-sync-cooldown-batch";
import { loadPaidSyncBackoffStatesForAccounts } from "@/lib/social/paid-social-sync-backoff-state";

jest.mock("@/lib/social/paid-social-sync-backoff-state", () => {
  const actual = jest.requireActual<typeof import("@/lib/social/paid-social-sync-backoff-state")>(
    "@/lib/social/paid-social-sync-backoff-state"
  );
  return {
    ...actual,
    loadPaidSyncBackoffStatesForAccounts: jest.fn(),
  };
});

describe("loadPaidSyncCooldownProjectionsForAccountKeys", () => {
  beforeEach(() => {
    jest.mocked(loadPaidSyncBackoffStatesForAccounts).mockReset().mockResolvedValue(new Map());
  });

  it("dedupes account keys into one backoff query", async () => {
    const db = {} as never;
    await loadPaidSyncCooldownProjectionsForAccountKeys(db, "meta_ads", ["42", "42", "99"], new Date("2026-06-01T00:00:00Z"));
    expect(loadPaidSyncBackoffStatesForAccounts).toHaveBeenCalledTimes(1);
    expect(loadPaidSyncBackoffStatesForAccounts).toHaveBeenCalledWith(db, "meta_ads", ["42", "99"]);
  });

  it("reuses one backoff row for multiple drafts on the same account", async () => {
    const until = new Date("2026-07-01T00:00:00Z");
    jest.mocked(loadPaidSyncBackoffStatesForAccounts).mockResolvedValue(
      new Map([
        [
          "42",
          {
            id: "r1",
            provider: "meta_ads",
            accountKey: "42",
            backoffUntil: until,
            lastFailureCategory: "throttled",
            consecutiveThrottleCount: 1,
            lastFailureAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ])
    );
    const db = {} as never;
    const now = new Date("2026-06-01T00:00:00Z");
    const m = await loadPaidSyncCooldownProjectionsForAccountKeys(db, "meta_ads", ["42", "42"], now);
    expect(m.get("42")?.syncCooldownActive).toBe(true);
    expect(m.get("42")?.syncCooldownReason).toBe("throttled");
  });

  it("projects inactive cooldown for expired backoff_until", async () => {
    jest.mocked(loadPaidSyncBackoffStatesForAccounts).mockResolvedValue(
      new Map([
        [
          "7",
          {
            id: "r1",
            provider: "meta_ads",
            accountKey: "7",
            backoffUntil: new Date("2025-01-01T00:00:00Z"),
            lastFailureCategory: "throttled",
            consecutiveThrottleCount: 0,
            lastFailureAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ])
    );
    const m = await loadPaidSyncCooldownProjectionsForAccountKeys({} as never, "meta_ads", ["7"], new Date("2026-01-01T00:00:00Z"));
    expect(m.get("7")?.syncCooldownActive).toBe(false);
  });
});
