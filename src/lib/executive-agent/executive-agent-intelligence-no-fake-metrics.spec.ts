import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultAgentIntelligenceRecords } from "@/lib/executive-agent/agent-intelligence-bus";

describe("agent intelligence defaults (no fabricated metrics)", () => {
  it("keeps numeric slots null until a confirmed loader fills them", () => {
    const rows = createDefaultAgentIntelligenceRecords();
    for (const r of rows) {
      assert.equal(r.source, "not_configured");
      assert.equal(r.activeConversations, null);
      assert.equal(r.totalConversations, null);
      assert.equal(r.leadsCaptured, null);
      assert.equal(r.recommendations, null);
      assert.equal(r.alerts, null);
      assert.equal(r.performanceScore, null);
    }
  });
});
