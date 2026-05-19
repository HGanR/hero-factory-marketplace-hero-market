import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFollowUpRecommendations,
  type ClientFollowUpSignals,
} from "@/lib/executive-agent/client-followup-recommendations";

describe("client follow-up recommendations", () => {
  it("does not embed placeholder client ids — admin supplies clientId only when queueing approval", () => {
    const signals: ClientFollowUpSignals = {
      pendingAccountsApprox30d: 2,
      approvedInactiveAccounts: 0,
      clientsStaleCount: 0,
      campaignsWithOutputsNoScheduledPost: 0,
      pendingExecutiveApprovals: 1,
      clientsWithEngagementNoAdminNote7d: 0,
      recentNoteActivitySample: [],
    };
    const recs = buildFollowUpRecommendations(signals);
    assert.ok(recs.length >= 1);
    const json = JSON.stringify(recs);
    assert.ok(!json.includes("00000000-0000-4000-8000-000000000001"));
    for (const r of recs) {
      assert.equal(r.requiresClientId, true);
      assert.equal(r.proposedAction, "createTodo");
      assert.ok(r.payloadTemplate.note.length > 0);
    }
  });
});
