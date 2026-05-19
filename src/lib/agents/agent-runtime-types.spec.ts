import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAgentRuntimeType } from "@/lib/agents/agent-runtime-types";

describe("resolveAgentRuntimeType", () => {
  it("maps SKIPPER name to executive_admin when column unset", () => {
    assert.equal(
      resolveAgentRuntimeType({ agentRuntimeType: null, name: "  skipper " }),
      "executive_admin"
    );
  });

  it("respects explicit agentRuntimeType column", () => {
    assert.equal(
      resolveAgentRuntimeType({ agentRuntimeType: "receptionist", name: "SKIPPER" }),
      "receptionist"
    );
  });

  it("defaults unknown names to general", () => {
    assert.equal(resolveAgentRuntimeType({ agentRuntimeType: null, name: "Helper" }), "general");
  });
});
