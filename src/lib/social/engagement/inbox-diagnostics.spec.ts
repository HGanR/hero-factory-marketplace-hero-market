import { describe, expect, it } from "@jest/globals";
import { loadInboxDiagnostics } from "./inbox-diagnostics";

function thenable<T>(v: T) {
  return { then: (on: (v: T) => void) => on(v) };
}

/**
 * `loadInboxDiagnostics` issues selects: counts, count, count+join, group, group+limit, dev-seed count, ingest errors.
 */
describe("loadInboxDiagnostics", () => {
  it("returns counts, dev-seed hint, and ingest error rows (or empty)", async () => {
    const r1: { c: number }[] = [{ c: 1 }];
    const r2: { c: number }[] = [{ c: 4 }];
    const r3: { c: number }[] = [{ c: 7 }];
    const r4: { provider: string; last: string | null }[] = [
      { provider: "meta", last: "2024-01-15T00:00:00.000Z" },
    ];
    const r5: { socialAccountId: string; provider: string; last: string | null }[] = [
      { socialAccountId: "acc-1", provider: "meta", last: "2024-01-10T00:00:00.000Z" },
    ];
    const r6: { c: number }[] = [{ c: 0 }];
    const r7: { lastSeenAt: Date; errorMessage: string; count: number; provider: string; errorCode: string }[] = [];
    const q = [r1, r2, r3, r4, r5, r6, r7];
    let n = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = {
      select: () => {
        n += 1;
        const k = n;
        if (k === 3) {
          return {
            from: () => ({
              innerJoin: () => ({
                where: () => thenable(q[2]),
              }),
            }),
          };
        }
        if (k === 4) {
          return {
            from: () => ({
              where: () => ({
                groupBy: () => thenable(q[3]),
              }),
            }),
          };
        }
        if (k === 5) {
          return {
            from: () => ({
              where: () => ({
                groupBy: () => ({
                  limit: () => thenable(q[4]),
                }),
              }),
            }),
          };
        }
        if (k === 6) {
          return {
            from: () => ({
              where: () => thenable(r6),
            }),
          };
        }
        if (k === 7) {
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => thenable(r7),
                }),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => thenable(q[k - 1] as (typeof r1) | (typeof r2)),
          }),
        };
      },
    };
    const d = await loadInboxDiagnostics(db, { userId: "u1", clientId: "c1", days: 7 });
    expect(n).toBe(7);
    expect(d.newThreadsInPeriod).toBe(1);
    expect(d.totalThreads).toBe(4);
    expect(d.messagesInPeriod).toBe(7);
    expect(d.lastIngestByProvider[0]?.provider).toBe("meta");
    expect(d.devSeededThreadCount).toBe(0);
    expect(d.recentIngestErrors).toEqual([]);
    expect(d.note).toMatch(/Ingest error persistence/);
  });
});
