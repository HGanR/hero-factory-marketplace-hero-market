/**
 * @jest-environment node
 */
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { logOrganicLatestSnapshotsBatch } from "@/lib/social/governed-post-analytics-latest-batch-log";

describe("logOrganicLatestSnapshotsBatch", () => {
  const base = {
    snapshotQueryStrategy: "mysql_row_number_latest_per_post_id" as const,
    distinctPostIds: 5,
    snapshotRowsReturned: 4,
  };

  afterEach(() => {
    delete process.env.ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG;
    jest.restoreAllMocks();
  });

  it("does not log when env unset", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    logOrganicLatestSnapshotsBatch(base);
    expect(spy).not.toHaveBeenCalled();
  });

  it("logs when ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG=1", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG = "1";
    logOrganicLatestSnapshotsBatch(base);
    expect(spy).toHaveBeenCalledWith(
      "[organic-post-analytics-latest-batch]",
      expect.stringContaining("mysql_row_number_latest_per_post_id")
    );
  });
});
