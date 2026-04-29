/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds,
  mapMysqlRowToPaidSocialAnalyticsSnapshotRow,
  mergeLatestPaidSnapshotRowsIntoMap,
} from "@/lib/social/paid-social-analytics-store";
import { simulateLatestSnapshotRowsPerPartition } from "@/lib/social/analytics-latest-snapshot-test-sim";

describe("mergeLatestPaidSnapshotRowsIntoMap", () => {
  it("fills null for ids with no row", () => {
    const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
    const m = mergeLatestPaidSnapshotRowsIntoMap(ids, []);
    expect(m.get(ids[0])).toBeNull();
    expect(m.get(ids[1])).toBeNull();
  });

  it("picks each id’s row from window-style result (one row per paid campaign)", () => {
    const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const rows = [
      {
        id: "snap-b-new",
        campaign_paid_social_campaign_id: idB,
        provider: "meta_ads",
        metrics_json: { normalized: { impressions: 1 } },
        fetched_at: "2026-06-02T00:00:00.000Z",
        created_at: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "snap-a-new",
        campaign_paid_social_campaign_id: idA,
        provider: "meta_ads",
        metrics_json: { normalized: { impressions: 99 } },
        fetched_at: "2026-06-03T00:00:00.000Z",
        created_at: "2026-06-03T00:00:00.000Z",
      },
    ];
    const m = mergeLatestPaidSnapshotRowsIntoMap([idA, idB], rows);
    expect(m.get(idA)?.id).toBe("snap-a-new");
    expect((m.get(idA)?.metricsJson as { normalized?: { impressions?: number } })?.normalized?.impressions).toBe(99);
    expect(m.get(idB)?.id).toBe("snap-b-new");
  });

  it("simulates scale: many historical rows would exist in DB but SQL returns only latest per id", () => {
    const idHot = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const idQuiet = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const sqlWouldReturnOnly = [
      {
        id: "latest-hot",
        campaign_paid_social_campaign_id: idHot,
        provider: "meta_ads",
        metrics_json: {},
        fetched_at: "2026-12-31T23:59:59.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "latest-quiet",
        campaign_paid_social_campaign_id: idQuiet,
        provider: "meta_ads",
        metrics_json: {},
        fetched_at: "2026-06-01T12:00:00.000Z",
        created_at: "2026-06-01T12:00:00.000Z",
      },
    ];
    const m = mergeLatestPaidSnapshotRowsIntoMap([idHot, idQuiet], sqlWouldReturnOnly);
    expect(m.get(idHot)?.id).toBe("latest-hot");
    expect(m.get(idQuiet)?.id).toBe("latest-quiet");
  });
});

describe("mapMysqlRowToPaidSocialAnalyticsSnapshotRow", () => {
  it("maps snake_case fields", () => {
    const r = mapMysqlRowToPaidSocialAnalyticsSnapshotRow({
      id: "s1",
      campaign_paid_social_campaign_id: "p1",
      provider: "meta_ads",
      metrics_json: { x: 1 },
      fetched_at: "2026-01-05T00:00:00.000Z",
      created_at: "2026-01-05T00:00:00.000Z",
    });
    expect(r.id).toBe("s1");
    expect(r.campaignPaidSocialCampaignId).toBe("p1");
    expect(r.provider).toBe("meta_ads");
  });
});

describe("getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds (execute wiring)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns empty batch when no ids", async () => {
    const db = { execute: jest.fn() };
    const r = await getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds(db as never, []);
    expect(db.execute).not.toHaveBeenCalled();
    expect(r.snapshotRowsReturned).toBe(0);
    expect(r.snapshotQueryStrategy).toBe("mysql_row_number_latest_per_paid_campaign_id");
    expect(r.byPaidCampaignId.size).toBe(0);
  });

  it("parses mysql2 [rows, fields] execute result", async () => {
    const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const row = {
      id: "snap-e",
      campaign_paid_social_campaign_id: id,
      provider: "meta_ads",
      metrics_json: {},
      fetched_at: "2026-02-01T00:00:00.000Z",
      created_at: "2026-02-01T00:00:00.000Z",
    };
    const db = {
      execute: jest.fn().mockResolvedValue([[row], []]),
    };
    const r = await getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds(db as never, [id]);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(r.snapshotRowsReturned).toBe(1);
    expect(r.byPaidCampaignId.get(id)?.id).toBe("snap-e");
  });

  it("parses flat rows array execute result", async () => {
    const id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const row = {
      id: "snap-f",
      campaign_paid_social_campaign_id: id,
      provider: "meta_ads",
      metrics_json: {},
      fetched_at: "2026-03-01T00:00:00.000Z",
      created_at: "2026-03-01T00:00:00.000Z",
    };
    const db = {
      execute: jest.fn().mockResolvedValue([row]),
    };
    const r = await getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds(db as never, [id]);
    expect(r.snapshotRowsReturned).toBe(1);
    expect(r.byPaidCampaignId.get(id)?.id).toBe("snap-f");
  });

  it("matches ROW_NUMBER semantics across skewed snapshot counts and same-ts id tie-break", async () => {
    const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const tTie = "2026-10-01T08:00:00.000Z";
    const allRows = [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `a-hist-${i}`,
        campaign_paid_social_campaign_id: idA,
        provider: "meta_ads",
        metrics_json: {},
        fetched_at: `2026-05-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
        created_at: "2026-05-01T00:00:00.000Z",
      })),
      {
        id: "a-tie-aaa",
        campaign_paid_social_campaign_id: idA,
        provider: "meta_ads",
        metrics_json: { v: "lose" },
        fetched_at: tTie,
        created_at: tTie,
      },
      {
        id: "a-tie-zzz",
        campaign_paid_social_campaign_id: idA,
        provider: "meta_ads",
        metrics_json: { v: "win" },
        fetched_at: tTie,
        created_at: tTie,
      },
      {
        id: "b-only",
        campaign_paid_social_campaign_id: idB,
        provider: "meta_ads",
        metrics_json: { v: "b" },
        fetched_at: "2026-04-01T00:00:00.000Z",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ];
    const winners = simulateLatestSnapshotRowsPerPartition(
      allRows,
      "campaign_paid_social_campaign_id",
      "fetched_at"
    );
    expect(winners).toHaveLength(2);
    const wa = winners.find((w) => w.campaign_paid_social_campaign_id === idA);
    const wb = winners.find((w) => w.campaign_paid_social_campaign_id === idB);
    expect(wa?.id).toBe("a-tie-zzz");
    expect(wb?.id).toBe("b-only");

    const db = { execute: jest.fn().mockResolvedValue([winners, []]) };
    const r = await getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds(db as never, [idA, idB]);
    expect(r.byPaidCampaignId.get(idA)?.id).toBe("a-tie-zzz");
    expect(r.byPaidCampaignId.get(idB)?.id).toBe("b-only");
  });
});
