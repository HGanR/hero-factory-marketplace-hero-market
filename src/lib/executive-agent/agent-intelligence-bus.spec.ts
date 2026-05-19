import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAgentIntelligence,
  buildAgentIntelligenceResponse,
  createDefaultAgentIntelligenceRecords,
  filterAgentsByKeys,
  parseAgentKeysQuery,
} from "@/lib/executive-agent/agent-intelligence-bus";

describe("agent-intelligence-bus", () => {
  it("normalizes default agents with not_configured source", () => {
    const rows = createDefaultAgentIntelligenceRecords();
    assert.equal(rows.length, 5);
    assert.ok(rows.every((r) => r.source === "not_configured"));
    assert.ok(rows.every((r) => r.activeConversations === null));
  });

  it("filters by explicit keys", () => {
    const rows = createDefaultAgentIntelligenceRecords();
    const f = filterAgentsByKeys(rows, ["reality", "bentley"]);
    assert.equal(f.length, 2);
    assert.ok(f.every((r) => r.agentKey === "reality" || r.agentKey === "bentley"));
  });

  it("parseAgentKeysQuery handles comma-separated keys", () => {
    assert.deepEqual(parseAgentKeysQuery("reality, bentley"), ["reality", "bentley"]);
    assert.equal(parseAgentKeysQuery(""), null);
  });

  it("aggregate reflects selected agents only", () => {
    const rows = filterAgentsByKeys(createDefaultAgentIntelligenceRecords(), ["eleanor"]);
    const agg = aggregateAgentIntelligence(rows);
    assert.equal(agg.selectedAgentCount, 1);
    assert.equal(agg.source, "not_configured");
  });

  it("buildAgentIntelligenceResponse includes aggregate", () => {
    const out = buildAgentIntelligenceResponse(createDefaultAgentIntelligenceRecords());
    assert.equal(out.agents.length, 5);
    assert.equal(out.aggregate.selectedAgentCount, 5);
  });

  it("lists SKIPPER as the fifth agent key with display name SKIPPER", () => {
    const rows = createDefaultAgentIntelligenceRecords();
    assert.equal(rows.length, 5);
    assert.equal(rows[4]!.agentKey, "skipper");
    assert.equal(rows[4]!.displayName, "SKIPPER");
  });
});
