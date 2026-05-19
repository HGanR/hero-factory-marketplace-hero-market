import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WRITE_ACTION_NAMES,
  canInvokeReadTool,
  defaultExecutiveReadScopes,
  isWriteAction,
  writeActionRequiresApproval,
} from "@/lib/executive-agent/executive-agent-policy";

describe("executive-agent-policy", () => {
  it("marks every write action as approval-required", () => {
    for (const a of WRITE_ACTION_NAMES) {
      assert.equal(writeActionRequiresApproval(a), true);
    }
  });

  it("recognizes write action names", () => {
    assert.equal(isWriteAction("createTodo"), true);
    assert.equal(isWriteAction("unknown"), false);
  });

  it("grants read tools only when scope is present", () => {
    const granted = new Set(defaultExecutiveReadScopes());
    assert.equal(canInvokeReadTool("getPendingAccounts", granted), true);
    assert.equal(canInvokeReadTool("getBentleyExecutiveBridgeSummary", granted), true);
    assert.equal(canInvokeReadTool("getUnknownTool", granted), false);
  });
});
