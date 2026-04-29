jest.mock("@/lib/db", () => ({ getDb: jest.fn() }));
jest.mock("@/lib/db/client-hub-ensure", () => ({ ensureClientHubTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/revenue-os/client-hub-rollup", () => ({ getClientHubRollupForOwnedClient: jest.fn() }));
jest.mock("@/lib/site-builder/intelligence/client-hub-rollup-sync", () => ({
  syncClientHubRollupToSiteIntelligence: jest.fn(),
}));

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getDb } from "@/lib/db";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import { syncClientHubRollupToSiteIntelligence } from "@/lib/site-builder/intelligence/client-hub-rollup-sync";
import {
  resolveSiteIntelligenceSyncRuntimeOpts,
  runSiteIntelligenceRollupSync,
} from "../../../scripts/revenue-os/sync-site-intelligence-rollups";

function makeDbBatches(batches: Array<Array<{ id: string; ownerUserId: number; updatedAt: Date }>>) {
  let i = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => batches[i++] ?? [],
          }),
        }),
      }),
    }),
  };
}

describe("site intelligence cron script", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("respects limit and dryRun", async () => {
    jest.mocked(getDb).mockResolvedValue(
      makeDbBatches([
        [
          { id: "c1", ownerUserId: 1, updatedAt: new Date() },
          { id: "c2", ownerUserId: 2, updatedAt: new Date() },
        ],
        [{ id: "c3", ownerUserId: 3, updatedAt: new Date() }],
      ]) as never,
    );
    jest.mocked(getClientHubRollupForOwnedClient).mockResolvedValue({
      leadsCaptured: 0,
      conversationsOpened: 0,
      openConversations: 0,
      bookings: 0,
      crmMessagesCount: 0,
      widgetMessagesCount: 0,
      messagesExchanged: 0,
      agentInteractions: 0,
      activeSites: 0,
      activeAgents: 0,
      campaignsLaunched: 0,
      publishedPosts: 0,
      websiteVisits: null,
      lastActivityAt: null,
      leadQualifiedCount: 0,
      followUpCount: 0,
      taskCreatedCount: 0,
      bookingScheduledCount: 0,
    });
    jest.mocked(syncClientHubRollupToSiteIntelligence).mockResolvedValue({ rowsMatched: 1, rowsChanged: 0 });
    const out = await runSiteIntelligenceRollupSync({ limit: 2, dryRun: true, batchSize: 2 });
    expect(out.processed).toBe(2);
    expect(syncClientHubRollupToSiteIntelligence).toHaveBeenCalledTimes(2);
    expect(jest.mocked(syncClientHubRollupToSiteIntelligence).mock.calls[0]?.[5]).toEqual({ dryRun: true });
  });

  it("reads env runtime options", () => {
    process.env.SITE_INTELLIGENCE_SYNC_LIMIT = "23";
    process.env.SITE_INTELLIGENCE_SYNC_DRY_RUN = "1";
    expect(resolveSiteIntelligenceSyncRuntimeOpts()).toEqual({ limit: 23, dryRun: true });
  });
});
