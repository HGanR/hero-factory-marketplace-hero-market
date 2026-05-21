import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFulfillmentOrderTimeline,
  hasClaudeHandoffEvent,
  resolveNextAdminAction,
} from "@/lib/fulfillment/fulfillment-order-detail-logic";

describe("fulfillment order detail logic", () => {
  it("resolves waiting on approval when approval is pending", () => {
    assert.equal(
      resolveNextAdminAction({
        pipelineStage: "service_drafting",
        paymentStatus: "confirmed",
        paymentConsumed: true,
        approvalStatus: "pending",
        hasClaudeHandoffEvent: true,
        orderSource: "claude_worker",
      }),
      "waiting_on_approval"
    );
  });

  it("resolves ready to propose after handoff with no approval", () => {
    assert.equal(
      resolveNextAdminAction({
        pipelineStage: "executive_handoff_received",
        paymentStatus: "confirmed",
        paymentConsumed: true,
        approvalStatus: "none",
        hasClaudeHandoffEvent: true,
        orderSource: "claude_worker",
      }),
      "ready_to_propose_site_builder_draft"
    );
  });

  it("builds timeline with payment, handoff, and approval milestones", () => {
    const timeline = buildFulfillmentOrderTimeline({
      paymentConfirmedAt: new Date("2026-05-20T10:00:00.000Z"),
      paymentStatus: "confirmed",
      events: [
        {
          id: "ev-1",
          actorType: "claude_worker",
          actorId: "key-1",
          fromStage: null,
          toStage: "executive_handoff_received",
          payloadJson: JSON.stringify({ primaryService: "WEBSITE" }),
          createdAt: new Date("2026-05-20T10:05:00.000Z"),
        },
        {
          id: "ev-2",
          actorType: "admin_human",
          actorId: "1",
          fromStage: "executive_handoff_received",
          toStage: "service_drafting",
          payloadJson: JSON.stringify({ proposedAction: "createSiteBuilderTask" }),
          createdAt: new Date("2026-05-20T10:10:00.000Z"),
        },
      ],
      approval: {
        id: "ap-1",
        status: "executed",
        proposedAction: "createSiteBuilderTask",
        createdAt: new Date("2026-05-20T10:10:00.000Z"),
        executedAt: new Date("2026-05-20T10:12:00.000Z"),
      },
    });

    const kinds = timeline.map((t) => t.kind);
    assert.ok(kinds.includes("payment_confirmed"));
    assert.ok(kinds.includes("claude_handoff_received"));
    assert.ok(kinds.includes("site_builder_draft_proposed"));
    assert.ok(kinds.includes("approval_created"));
    assert.ok(kinds.includes("approval_executed"));
    assert.equal(timeline[0]!.occurredAt <= timeline[timeline.length - 1]!.occurredAt, true);
  });

  it("detects Claude handoff events", () => {
    assert.equal(
      hasClaudeHandoffEvent([
        {
          id: "e",
          actorType: "claude_worker",
          actorId: null,
          fromStage: null,
          toStage: "executive_handoff_received",
          payloadJson: null,
          createdAt: new Date(),
        },
      ]),
      true
    );
  });
});
