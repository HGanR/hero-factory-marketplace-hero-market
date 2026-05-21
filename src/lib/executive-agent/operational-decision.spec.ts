import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSkipperPendingDecisionsContext,
  isDecisionUrgent,
  isExecutiveOperationalDecisionStatus,
} from "@/lib/executive-agent/executive-operational-decisions";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";

describe("executive operational decisions", () => {
  it("validates decision status enum", () => {
    assert.ok(isExecutiveOperationalDecisionStatus("open"));
    assert.ok(isExecutiveOperationalDecisionStatus("deferred"));
    assert.equal(isExecutiveOperationalDecisionStatus("auto"), false);
  });

  it("marks open decisions urgent and future-deferred not urgent", () => {
    assert.equal(isDecisionUrgent({ status: "open", deferredUntil: null }), true);
    assert.equal(
      isDecisionUrgent({
        status: "deferred",
        deferredUntil: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      false
    );
    assert.equal(
      isDecisionUrgent({
        status: "deferred",
        deferredUntil: new Date(Date.now() - 86_400_000).toISOString(),
      }),
      true
    );
  });

  it("builds skipper context with human-only guard", () => {
    const ctx = buildSkipperPendingDecisionsContext({
      pending: [
        {
          id: "1",
          title: "WEBSITE release gate",
          promptSummary: "Approve draft?",
          status: "open",
          priority: "high",
          sourceKind: "decision_request",
          threadId: "t1",
          questionMessageId: null,
          promotedFromMessageId: "m1",
          approvalId: null,
          orderId: "ord-1",
          clientId: null,
          subjectId: "site_builder",
          department: "WEBSITE",
          decisionText: null,
          decidedAt: null,
          decidedByAdminUserId: null,
          deferredUntil: null,
          deferReason: null,
          supersededByDecisionId: null,
          supersedesDecisionId: null,
          createdAt: "",
          updatedAt: "",
          urgent: true,
        },
      ],
      deferred: [],
    });
    assert.match(ctx, /must not decide/i);
    assert.match(ctx, /WEBSITE release gate/);
  });

  it("picker selects pending decisions tool", () => {
    const tools = pickExecutiveReadTools("What pending owner decisions need my attention?", null);
    assert.ok(tools.includes("getExecutivePendingDecisions"));
  });
});
