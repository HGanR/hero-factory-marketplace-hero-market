/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { simulateLatestSnapshotRowsPerPartition } from "@/lib/social/analytics-latest-snapshot-test-sim";

describe("simulateLatestSnapshotRowsPerPartition", () => {
  it("returns empty for empty input", () => {
    expect(simulateLatestSnapshotRowsPerPartition([], "k", "f")).toEqual([]);
  });

  it("partitions independently (varchar id DESC tie-break)", () => {
    const t = "2026-01-01T00:00:00.000Z";
    const rows = [
      { id: "b", pid: "p1", fetched_at: t },
      { id: "a", pid: "p1", fetched_at: t },
      { id: "only", pid: "p2", fetched_at: "2025-01-01T00:00:00.000Z" },
    ];
    const w = simulateLatestSnapshotRowsPerPartition(rows, "pid", "fetched_at");
    expect(w.map((r) => r.id).sort()).toEqual(["b", "only"]);
  });
});
