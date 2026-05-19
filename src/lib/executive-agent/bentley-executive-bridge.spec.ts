import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeBentleyExecutiveBridge } from "@/lib/executive-agent/bentley-executive-bridge";
import type { ExecutiveToolContext } from "@/lib/executive-agent/executive-agent-tools";

describe("bentley executive bridge", () => {
  it("captures subsection failures without throwing", async () => {
    const failingTail = {
      limit() {
        return Promise.reject(new Error("simulated_missing_table"));
      },
    };
    const orderByObj = { orderBy: () => failingTail };
    const fromObj = { from: () => orderByObj };
    const mockDb = { select: () => fromObj } as ExecutiveToolContext["db"];
    const ctx: ExecutiveToolContext = {
      db: mockDb,
      adminUserId: 1,
      selectedClientId: null,
      selectedCampaignId: null,
    };
    const out = await summarizeBentleyExecutiveBridge(mockDb, ctx);
    assert.ok(Array.isArray(out.notes));
    assert.ok(out.notes.some((n) => n.includes("simulated_missing_table") || n.includes("bentley_cadence_runs")));
    assert.equal(out.latestCadenceRuns.length, 0);
  });
});
