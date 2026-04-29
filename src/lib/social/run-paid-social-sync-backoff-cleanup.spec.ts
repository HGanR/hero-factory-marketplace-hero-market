/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from "@jest/globals";
import { runPaidSocialSyncBackoffCleanup } from "@/lib/social/run-paid-social-sync-backoff-cleanup";

describe("runPaidSocialSyncBackoffCleanup", () => {
  it("deletes nothing when no expired rows (active cooldown rows are not selected by the expiry query)", async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit }) }) });
    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    const db = {
      select,
      delete: jest.fn().mockReturnValue({ where: deleteWhere }),
    };
    const r = await runPaidSocialSyncBackoffCleanup(db as never, { limit: 10 });
    expect(r.scannedCount).toBe(0);
    expect(r.deletedCount).toBe(0);
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("deletes expired ids", async () => {
    const limit = jest.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const select = jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit }) }) });
    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    const db = {
      select,
      delete: jest.fn().mockReturnValue({ where: deleteWhere }),
    };
    const r = await runPaidSocialSyncBackoffCleanup(db as never, { limit: 50 });
    expect(r.scannedCount).toBe(2);
    expect(r.deletedCount).toBe(2);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
