import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeExecutiveOrchestratorAnswer,
  isInternalOrchestratorBoilerplate,
} from "@/lib/executive-agent/executive-orchestrator-answer";

describe("executive-orchestrator-answer", () => {
  it("never emits internal registry boilerplate", () => {
    const answer = composeExecutiveOrchestratorAnswer({
      reasoningSummary: "Deterministic routing from keywords, dashboard mode, and agent selection.",
      insights: [
        { title: "getApprovedAccounts", detail: "12 approved active accounts." },
        { title: "getPlatformAnalyticsSummary", detail: "Site visits today: 340." },
      ],
      requiresApprovalCount: 0,
      dryRunWriteDetected: false,
    });
    assert.ok(!isInternalOrchestratorBoilerplate(answer));
    assert.ok(!answer.toLowerCase().includes("insight block"));
    assert.ok(!answer.toLowerCase().includes("tool registry"));
    assert.ok(!answer.toLowerCase().includes("executive summary (read-only tools)"));
    assert.match(answer, /12 approved active accounts/i);
  });

  it("prefers LLM reasoning summary when not generic", () => {
    const answer = composeExecutiveOrchestratorAnswer({
      reasoningSummary: "Pending approvals are elevated; recommend reviewing the intake queue first.",
      insights: [{ title: "getPendingAccounts", detail: "4 pending accounts." }],
      requiresApprovalCount: 0,
      dryRunWriteDetected: false,
    });
    assert.match(answer, /Pending approvals are elevated/i);
  });

  it("includes approval queue note when writes are proposed", () => {
    const answer = composeExecutiveOrchestratorAnswer({
      reasoningSummary: "",
      insights: [],
      requiresApprovalCount: 2,
      dryRunWriteDetected: false,
    });
    assert.match(answer, /2 proposal\(s\) queued for your approval/i);
  });
});
