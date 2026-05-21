import type {
  FulfillmentOutcomeRecord,
  FulfillmentSuccessScoreRecord,
  OperationalMemoryOrderRecord,
} from "@/lib/fulfillment/fulfillment-operational-memory-types";

export function scoreFulfillmentSuccess(
  orders: OperationalMemoryOrderRecord[],
  outcomes: FulfillmentOutcomeRecord[]
): FulfillmentSuccessScoreRecord[] {
  const outcomeByOrder = new Map(outcomes.map((o) => [o.orderId, o]));

  return orders.map((o) => {
    const outcome = outcomeByOrder.get(o.orderId);
    const factors: string[] = [];
    let score = 70;

    if (o.pipelineStage === "released" || o.pipelineStage === "approved_for_release") {
      score += 20;
      factors.push("Near release milestone");
    }
    if (o.clientDeliveryStatus === "client_approved") {
      score += 15;
      factors.push("Client approved deliverable");
    }
    if (outcome?.outcome === "website_draft_low_revision") {
      score += 10;
      factors.push("Low-revision WEBSITE path");
    }
    if (outcome?.outcome === "revision_heavy") {
      score -= 20;
      factors.push("Revision-heavy cycle");
    }
    if (outcome?.outcome === "approval_blocked" || outcome?.outcome === "trust_packet_stalled") {
      score -= 25;
      factors.push(outcome.summary);
    }
    if (o.daysInCurrentStage >= 7) {
      score -= 15;
      factors.push(`Long stage dwell (${o.daysInCurrentStage}d)`);
    }
    if (o.approvalStatus === "pending") {
      score -= 10;
      factors.push("Pending executive approval");
    }

    score = Math.max(0, Math.min(100, score));
    const tier =
      score >= 85 ? "excellent" : score >= 65 ? "good" : score >= 45 ? "at_risk" : "critical";

    return {
      orderId: o.orderId,
      clientId: o.clientId,
      department: o.department,
      score,
      tier,
      factors: factors.length ? factors : ["Baseline desk progression"],
    };
  });
}
