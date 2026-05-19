import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import { isWriteAction, WRITE_ACTION_NAMES } from "@/lib/executive-agent/executive-agent-policy";

describe("executive-agent-read-tool-picker", () => {
  it("adds Bentley read tools when bentley is selected without enabling writes", () => {
    const tools = pickExecutiveReadTools("hello", null, { selectedAgents: ["bentley"] });
    assert.ok(tools.includes("getBentleyCampaignOutputs"));
    assert.ok(tools.includes("getAiRevenueOsStatus"));
    assert.ok(tools.includes("getBentleyExecutiveBridgeSummary"));
    for (const t of tools) {
      assert.equal(isWriteAction(t), false);
    }
  });

  it("biases tools from dashboard mode", () => {
    const conv = pickExecutiveReadTools("x", null, { dashboardMode: "CONVERSATIONS" });
    assert.ok(conv.includes("getAgentConversationSummary"));
  });
});

describe("executive write guard (no new silent writes)", () => {
  it("does not treat read tool names as writes", () => {
    for (const name of [
      "getPendingAccounts",
      "getBentleyCampaignOutputs",
      "getBentleyExecutiveBridgeSummary",
      "getAgentConversationSummary",
    ]) {
      assert.equal(isWriteAction(name), false);
    }
  });

  it("WRITE_ACTION_NAMES unchanged count sanity", () => {
    assert.ok(WRITE_ACTION_NAMES.length >= 6);
  });
});
