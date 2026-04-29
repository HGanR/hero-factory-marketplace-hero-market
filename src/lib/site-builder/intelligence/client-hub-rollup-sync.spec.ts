import * as siteBuilderDb from "@/lib/site-builder/db";
import {
  mapClientHubRollupToIntelligenceMetrics,
  syncClientHubRollupToSiteIntelligence,
} from "@/lib/site-builder/intelligence/client-hub-rollup-sync";
import type { ClientHubRollup } from "@/lib/revenue-os/client-hub-types";

function minimalRoll(over: Partial<ClientHubRollup> = {}): ClientHubRollup {
  return {
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
    ...over,
  };
}

describe("mapClientHubRollupToIntelligenceMetrics", () => {
  it("maps only aggregate counts — numeric outputs only", () => {
    const roll = minimalRoll({
      leadsCaptured: 12,
      conversationsOpened: 3,
      openConversations: 1,
      bookings: 2,
      crmMessagesCount: 999,
      widgetMessagesCount: 7,
      messagesExchanged: 1006,
      agentInteractions: 7,
      activeSites: 1,
      activeAgents: 1,
      bookingScheduledCount: 4,
    });
    const m = mapClientHubRollupToIntelligenceMetrics(roll);
    expect(m).toEqual({
      rollupLeadsCaptured: 12,
      rollupConversationsOpened: 3,
      rollupWidgetMessages: 7,
      rollupBookingsScheduled: 4,
    });
    for (const v of Object.values(m)) {
      expect(typeof v).toBe("number");
    }
  });

  it("floors negative junk to zero", () => {
    const roll = minimalRoll({
      leadsCaptured: -1,
      conversationsOpened: 1.9 as unknown as number,
      widgetMessagesCount: -5,
    });
    expect(mapClientHubRollupToIntelligenceMetrics(roll)).toEqual({
      rollupLeadsCaptured: 0,
      rollupConversationsOpened: 1,
      rollupWidgetMessages: 0,
      rollupBookingsScheduled: 0,
    });
  });
});

describe("syncClientHubRollupToSiteIntelligence", () => {
  beforeEach(() => {
    jest.spyOn(siteBuilderDb, "ensureSiteBuilderIntelligenceTables").mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("runs count + diff-aware UPDATE when site ids are present", async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([[{ n: 3 }], []])
      .mockResolvedValueOnce([{ changedRows: 2 }, []]);
    const out = await syncClientHubRollupToSiteIntelligence(
      { execute } as never,
      7,
      "client-uuid",
      ["site-a", "site-b"],
      minimalRoll({ leadsCaptured: 2 }),
    );
    expect(execute).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ rowsMatched: 3, rowsChanged: 2 });
  });

  it("no-ops when metrics unchanged (rowsChanged = 0)", async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([[{ n: 2 }], []])
      .mockResolvedValueOnce([{ changedRows: 0 }, []]);
    const out = await syncClientHubRollupToSiteIntelligence(
      { execute } as never,
      7,
      "client-uuid",
      [],
      minimalRoll({ widgetMessagesCount: 5 }),
    );
    expect(execute).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ rowsMatched: 2, rowsChanged: 0 });
  });

  it("supports dry run (count only, no UPDATE)", async () => {
    const execute = jest.fn().mockResolvedValueOnce([[{ n: 11 }], []]);
    const out = await syncClientHubRollupToSiteIntelligence(
      { execute } as never,
      7,
      "client-uuid",
      [],
      minimalRoll({ widgetMessagesCount: 5 }),
      { dryRun: true },
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ rowsMatched: 11, rowsChanged: 0 });
  });
});
