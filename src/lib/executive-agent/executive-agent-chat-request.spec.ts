import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExecutiveChatBodySchema } from "@/lib/executive-agent/executive-agent-chat-request";

describe("executive-agent-chat-request", () => {
  it("accepts selectedAgents, time range, and dashboard mode", () => {
    const body = ExecutiveChatBodySchema.parse({
      prompt: "Summarize pending accounts",
      mode: "read",
      selectedAgents: ["bentley", "reality"],
      selectedTimeRange: "24H",
      dashboardMode: "REVENUE",
    });
    assert.deepEqual(body.selectedAgents, ["bentley", "reality"]);
    assert.equal(body.selectedTimeRange, "24H");
    assert.equal(body.dashboardMode, "REVENUE");
  });

  it("rejects unknown agent keys", () => {
    assert.throws(() =>
      ExecutiveChatBodySchema.parse({
        prompt: "x",
        selectedAgents: ["not_an_agent"],
      }),
    );
  });
});
