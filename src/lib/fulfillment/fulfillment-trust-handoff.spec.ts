import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ClaudeFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas";
import { ClaudeTrustFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas-trust";
import { buildTrustFulfillmentPacketPayloadFromOrder } from "@/lib/fulfillment/fulfillment-trust-packet-payload";
import { TRUST_FULFILLMENT_LEGAL_DISCLAIMER } from "@/lib/fulfillment/fulfillment-trust-legal";
import {
  resolveTrustNextAdminAction,
  buildTrustFulfillmentOrderTimeline,
} from "@/lib/fulfillment/fulfillment-trust-order-detail-logic";
import { CreateTrustFulfillmentPacketPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import { isWriteAction, WRITE_ACTION_NAMES } from "@/lib/executive-agent/executive-agent-policy";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";
const PAYMENT_ID = "00000000-0000-4000-8000-000000000099";
const ORDER_ID = "00000000-0000-4000-8000-0000000000aa";

const TRUST_ACKS = {
  noLegalAdvice: true as const,
  noAutoFulfillment: true as const,
  noAutoPublish: true as const,
  noFinalLegalDocument: true as const,
  preparedForLegalReview: true as const,
  recommendAttorneyReview: true as const,
};

describe("TRUST handoff payload", () => {
  const validTrust = {
    version: "1" as const,
    client: { clientId: CLIENT_ID },
    service: { primary: "TRUST" as const },
    payment: { confirmationId: PAYMENT_ID },
    salesSummary: { text: "Client purchased trust records review package." },
    requestedDeliverable: {
      type: "trust_review_packet" as const,
      title: "Trust review packet",
    },
    acknowledgements: TRUST_ACKS,
  };

  it("accepts TRUST handoff with required legal acknowledgements", () => {
    assert.ok(ClaudeTrustFulfillmentHandoffBodySchema.safeParse(validTrust).success);
  });

  it("rejects TRUST handoff without noFinalLegalDocument acknowledgement", () => {
    const { noFinalLegalDocument: _n, ...partial } = TRUST_ACKS;
    const r = ClaudeTrustFulfillmentHandoffBodySchema.safeParse({
      ...validTrust,
      acknowledgements: partial,
    });
    assert.equal(r.success, false);
  });

  it("WEBSITE schema rejects TRUST primary (branch isolation at schema)", () => {
    assert.equal(
      ClaudeFulfillmentHandoffBodySchema.safeParse({
        version: "1",
        client: { clientId: CLIENT_ID },
        service: { primary: "TRUST" },
        payment: { confirmationId: PAYMENT_ID },
        salesSummary: { text: "x" },
        requestedDeliverable: { type: "site_builder_package", title: "x" },
        acknowledgements: { noLegalAdvice: true, noAutoFulfillment: true, noAutoPublish: true },
      }).success,
      false
    );
  });
});

describe("trust packet payload", () => {
  it("builds createTrustFulfillmentPacket payload with legal disclaimer in markdown", () => {
    const payload = buildTrustFulfillmentPacketPayloadFromOrder({
      id: ORDER_ID,
      clientId: CLIENT_ID,
      salesSummaryText: "Family trust planning intake.",
      requestedDeliverableJson: JSON.stringify({
        type: "trust_review_packet",
        title: "Legal review packet",
      }),
      executiveHandoffJson: JSON.stringify({
        trustIntake: { trustPurpose: "Estate planning", jurisdictionState: "CA" },
      }),
    });
    const parsed = CreateTrustFulfillmentPacketPayloadSchema.safeParse(payload);
    assert.ok(parsed.success);
    assert.equal(parsed.data?.primaryService, "TRUST");
    assert.equal(parsed.data?.fulfillmentOrderId, ORDER_ID);
    assert.ok(parsed.data?.packetMarkdown.includes(TRUST_FULFILLMENT_LEGAL_DISCLAIMER));
    assert.match(parsed.data?.packetMarkdown, /PREPARED FOR LEGAL REVIEW/i);
  });
});

describe("trust owner review transitions (logic)", () => {
  it("resolves propose trust packet after handoff", () => {
    const action = resolveTrustNextAdminAction({
      pipelineStage: "executive_handoff_received",
      paymentStatus: "confirmed",
      paymentConsumed: true,
      approvalStatus: "none",
      hasClaudeHandoffEvent: true,
      orderSource: "claude_worker",
    });
    assert.equal(action, "ready_to_propose_trust_packet");
  });

  it("resolves owner review when packet linked", () => {
    const action = resolveTrustNextAdminAction({
      pipelineStage: "owner_review",
      paymentStatus: "confirmed",
      paymentConsumed: true,
      approvalStatus: "executed",
      hasClaudeHandoffEvent: true,
      orderSource: "claude_worker",
      deliverableLinked: true,
      deliverableReviewStatus: "pending",
    });
    assert.equal(action, "trust_packet_owner_review");
  });

  it("timeline includes trust_packet_proposed kind", () => {
    const timeline = buildTrustFulfillmentOrderTimeline({
      paymentConfirmedAt: new Date().toISOString(),
      paymentStatus: "confirmed",
      events: [
        {
          id: "e1",
          actorType: "admin_human",
          actorId: "1",
          fromStage: "executive_handoff_received",
          toStage: "service_drafting",
          payloadJson: JSON.stringify({
            proposedAction: "createTrustFulfillmentPacket",
            deliverableRouting: "trust_packet_only",
          }),
          createdAt: new Date().toISOString(),
        },
      ],
      approval: null,
    });
    assert.ok(timeline.some((t) => t.kind === "trust_packet_proposed"));
  });
});

describe("TRUST slice safety (source)", () => {
  it("registers createTrustFulfillmentPacket as write action", () => {
    assert.ok(WRITE_ACTION_NAMES.includes("createTrustFulfillmentPacket"));
    assert.equal(isWriteAction("createTrustFulfillmentPacket"), true);
  });

  it("executor does not call jarva apply or mutate trusts table", () => {
    const p = join(__dirname, "../executive-agent/executive-action-executors.ts");
    const src = readFileSync(p, "utf8");
    const fnStart = src.indexOf("async function runCreateTrustFulfillmentPacket");
    const fnEnd = src.indexOf("async function runCreateSiteBuilderTask");
    assert.ok(fnStart > 0 && fnEnd > fnStart);
    const body = src.slice(fnStart, fnEnd);
    assert.doesNotMatch(body, /trust-intake\/apply/i);
    assert.doesNotMatch(body, /\.insert\(trusts\)/i);
    assert.doesNotMatch(body, /\.update\(trusts\)/i);
    assert.match(body, /visibility:\s*["']internal["']/);
  });

  it("handoff route uses dispatch not WEBSITE-only service", () => {
    const p = join(__dirname, "../../app/api/v1/workers/claude/fulfillment-handoffs/route.ts");
    const src = readFileSync(p, "utf8");
    assert.match(src, /claude-fulfillment-handoff-dispatch/);
    assert.doesNotMatch(src, /from "@\/lib\/fulfillment\/claude-handoff-service"/);
  });
});
