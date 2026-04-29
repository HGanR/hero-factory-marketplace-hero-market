/**
 * @jest-environment node
 */
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { logPaidListProjection } from "@/lib/social/paid-social-list-projection-log";

describe("logPaidListProjection", () => {
  const base = {
    snapshotQueryStrategy: "mysql_row_number_latest_per_paid_campaign_id" as const,
    paidCampaignCount: 2,
    snapshotRowsReturned: 2,
    cooldownDistinctAccountKeys: 1,
    durationMs: 5,
  };

  afterEach(() => {
    delete process.env.PAID_SOCIAL_LIST_PROJECTION_LOG;
    jest.restoreAllMocks();
  });

  it("does not log when env unset", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.PAID_SOCIAL_LIST_PROJECTION_LOG;
    logPaidListProjection(base);
    expect(spy).not.toHaveBeenCalled();
  });

  it("logs JSON when PAID_SOCIAL_LIST_PROJECTION_LOG=1", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.PAID_SOCIAL_LIST_PROJECTION_LOG = "1";
    logPaidListProjection(base);
    expect(spy).toHaveBeenCalledWith(
      "[paid-social-list-projection]",
      expect.stringContaining("mysql_row_number_latest_per_paid_campaign_id")
    );
  });
});
