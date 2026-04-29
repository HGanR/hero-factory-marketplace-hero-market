/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  getLatestAnalyticsSnapshotRowsForPostIds,
  mapMysqlRowToOrganicAnalyticsSnapshotRow,
  mergeLatestOrganicSnapshotRowsIntoMap,
} from "@/lib/social/governed-post-analytics-store";
import { simulateLatestSnapshotRowsPerPartition } from "@/lib/social/analytics-latest-snapshot-test-sim";

describe("mapMysqlRowToOrganicAnalyticsSnapshotRow", () => {
  it("maps snake_case columns", () => {
    const r = mapMysqlRowToOrganicAnalyticsSnapshotRow({
      id: "snap-1",
      campaign_post_id: "post-1",
      provider: "instagram",
      provider_post_id: "99",
      snapshot_type: "platform_lifetime",
      metrics_json: { version: 1 },
      fetched_at: "2026-04-01T12:00:00.000Z",
      created_at: "2026-04-01T12:00:00.000Z",
    });
    expect(r.id).toBe("snap-1");
    expect(r.campaignPostId).toBe("post-1");
    expect(r.providerPostId).toBe("99");
    expect(r.snapshotType).toBe("platform_lifetime");
  });

  it("normalizes null provider_post_id", () => {
    const r = mapMysqlRowToOrganicAnalyticsSnapshotRow({
      id: "s",
      campaign_post_id: "p",
      provider: "linkedin",
      provider_post_id: null,
      snapshot_type: "platform_lifetime",
      metrics_json: {},
      fetched_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(r.providerPostId).toBeNull();
  });
});

describe("mergeLatestOrganicSnapshotRowsIntoMap", () => {
  it("builds map keyed by campaign_post_id", () => {
    const postA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const postB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const rows = [
      {
        id: "b-new",
        campaign_post_id: postB,
        provider: "instagram",
        provider_post_id: "1",
        snapshot_type: "platform_lifetime",
        metrics_json: {},
        fetched_at: "2026-06-02T00:00:00.000Z",
        created_at: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "a-new",
        campaign_post_id: postA,
        provider: "instagram",
        provider_post_id: "2",
        snapshot_type: "platform_lifetime",
        metrics_json: {},
        fetched_at: "2026-06-03T00:00:00.000Z",
        created_at: "2026-06-03T00:00:00.000Z",
      },
    ];
    const m = mergeLatestOrganicSnapshotRowsIntoMap(rows);
    expect(m.get(postA)?.id).toBe("a-new");
    expect(m.get(postB)?.id).toBe("b-new");
  });

  it("simulates same fetched_at tie-break: SQL returns row with higher id (id DESC)", () => {
    const postId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const t = "2026-07-01T10:00:00.000Z";
    const sqlReturnsWinner = [
      {
        id: "zzz-later-uuid",
        campaign_post_id: postId,
        provider: "linkedin",
        provider_post_id: "u",
        snapshot_type: "platform_lifetime",
        metrics_json: { winner: true },
        fetched_at: t,
        created_at: t,
      },
    ];
    const m = mergeLatestOrganicSnapshotRowsIntoMap(sqlReturnsWinner);
    expect(m.get(postId)?.id).toBe("zzz-later-uuid");
    expect((m.get(postId)?.metricsJson as { winner?: boolean }).winner).toBe(true);
  });
});

describe("getLatestAnalyticsSnapshotRowsForPostIds (execute wiring)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns empty map for empty post ids", async () => {
    const db = { execute: jest.fn() };
    const m = await getLatestAnalyticsSnapshotRowsForPostIds(db as never, []);
    expect(db.execute).not.toHaveBeenCalled();
    expect(m.size).toBe(0);
  });

  it("parses mysql2 [rows, fields] execute result", async () => {
    const postId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const row = {
      id: "snap-d",
      campaign_post_id: postId,
      provider: "instagram",
      provider_post_id: "9",
      snapshot_type: "platform_lifetime",
      metrics_json: {},
      fetched_at: "2026-02-01T00:00:00.000Z",
      created_at: "2026-02-01T00:00:00.000Z",
    };
    const db = { execute: jest.fn().mockResolvedValue([[row], []]) };
    const m = await getLatestAnalyticsSnapshotRowsForPostIds(db as never, [postId]);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(m.get(postId)?.id).toBe("snap-d");
  });

  it("dedupes duplicate post ids in input (single execute)", async () => {
    const postId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const db = { execute: jest.fn().mockResolvedValue([[], []]) };
    await getLatestAnalyticsSnapshotRowsForPostIds(db as never, [postId, postId]);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  /**
   * Part 57: integration-style confidence — simulate full snapshot history, expect the same rows
   * the DB window query would return (one noisy post must not hide another’s latest).
   */
  it("matches ROW_NUMBER semantics for interleaved posts, ties, and skewed history counts", async () => {
    const postHot = "11111111-1111-4111-8111-111111111111";
    const postQuiet = "22222222-2222-4222-8222-222222222222";
    const sameTs = "2026-08-15T12:00:00.000Z";
    const allRows = [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `hot-old-${i}`,
        campaign_post_id: postHot,
        provider: "instagram",
        provider_post_id: "x",
        snapshot_type: "platform_lifetime",
        metrics_json: {},
        fetched_at: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        created_at: "2026-01-01T00:00:00.000Z",
      })),
      {
        id: "hot-tie-aaa",
        campaign_post_id: postHot,
        provider: "instagram",
        provider_post_id: "x",
        snapshot_type: "platform_lifetime",
        metrics_json: { tag: "lose-tie" },
        fetched_at: sameTs,
        created_at: sameTs,
      },
      {
        id: "hot-tie-zzz",
        campaign_post_id: postHot,
        provider: "instagram",
        provider_post_id: "x",
        snapshot_type: "platform_lifetime",
        metrics_json: { tag: "win-tie" },
        fetched_at: sameTs,
        created_at: sameTs,
      },
      {
        id: "quiet-mid",
        campaign_post_id: postQuiet,
        provider: "linkedin",
        provider_post_id: "y",
        snapshot_type: "platform_lifetime",
        metrics_json: { tag: "quiet-old" },
        fetched_at: "2026-03-01T00:00:00.000Z",
        created_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "quiet-latest",
        campaign_post_id: postQuiet,
        provider: "linkedin",
        provider_post_id: "y",
        snapshot_type: "platform_lifetime",
        metrics_json: { tag: "quiet-new" },
        fetched_at: "2026-09-01T00:00:00.000Z",
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const sqlWouldReturn = simulateLatestSnapshotRowsPerPartition(
      allRows,
      "campaign_post_id",
      "fetched_at"
    );
    expect(sqlWouldReturn).toHaveLength(2);
    const byPost = new Map(sqlWouldReturn.map((r) => [r.campaign_post_id, r]));
    expect(byPost.get(postHot)?.id).toBe("hot-tie-zzz");
    expect((byPost.get(postHot)?.metrics_json as { tag?: string }).tag).toBe("win-tie");
    expect(byPost.get(postQuiet)?.id).toBe("quiet-latest");

    const db = { execute: jest.fn().mockResolvedValue([sqlWouldReturn, []]) };
    const m = await getLatestAnalyticsSnapshotRowsForPostIds(db as never, [postHot, postQuiet]);
    expect(m.get(postHot)?.id).toBe("hot-tie-zzz");
    expect(m.get(postQuiet)?.id).toBe("quiet-latest");
  });
});
