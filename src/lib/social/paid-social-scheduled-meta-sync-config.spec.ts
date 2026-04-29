/**
 * @jest-environment node
 */
import { describe, it, expect, afterEach } from "@jest/globals";
import {
  getScheduledPaidMetaSyncConfig,
  SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD,
} from "@/lib/social/paid-social-scheduled-meta-sync-config";

describe("getScheduledPaidMetaSyncConfig", () => {
  let savedMaxItems: string | undefined;

  afterEach(() => {
    if (savedMaxItems === undefined) delete process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS;
    else process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS = savedMaxItems;
    savedMaxItems = undefined;
  });

  it("clamps maxItems to hard max", () => {
    savedMaxItems = process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS;
    process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS = String(SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD + 50);
    const c = getScheduledPaidMetaSyncConfig();
    expect(c.maxItems).toBe(SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD);
  });

  it("applies overrides without using env for overridden key", () => {
    savedMaxItems = process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS;
    process.env.SCHEDULED_PAID_META_SYNC_MAX_ITEMS = "3";
    const c = getScheduledPaidMetaSyncConfig({ maxItems: 7 });
    expect(c.maxItems).toBe(7);
  });
});
