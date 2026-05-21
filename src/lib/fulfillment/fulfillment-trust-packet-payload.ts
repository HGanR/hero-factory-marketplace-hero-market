import { z } from "zod";
import { CreateTrustFulfillmentPacketPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import { buildFulfillmentTrustReviewPacketMarkdown, resolveTrustArtifactType } from "@/lib/fulfillment/trust-review-packet-builder";
import { loadTrustIntakeFromOrder } from "@/lib/fulfillment/trust-intake-summary";
import {
  FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
} from "@/lib/fulfillment/fulfillment-types";

export const ProposeTrustPacketBodySchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
});

export type FulfillmentTrustOrderPayloadSource = {
  id: string;
  clientId: string;
  salesSummaryText: string | null;
  requestedDeliverableJson: string | null;
  executiveHandoffJson?: string | null;
};

function parseRequestedDeliverable(json: string | null): {
  title?: string;
  type?: string;
} {
  if (!json?.trim()) return {};
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    return {
      title: typeof v.title === "string" ? v.title : undefined,
      type: typeof v.type === "string" ? v.type : undefined,
    };
  } catch {
    return {};
  }
}

export function buildTrustFulfillmentPacketPayloadFromOrder(
  order: FulfillmentTrustOrderPayloadSource,
  overrides?: z.infer<typeof ProposeTrustPacketBodySchema>
): z.infer<typeof CreateTrustFulfillmentPacketPayloadSchema> {
  const deliverable = parseRequestedDeliverable(order.requestedDeliverableJson);
  const intake = loadTrustIntakeFromOrder({
    executiveHandoffJson: order.executiveHandoffJson,
    salesSummaryText: order.salesSummaryText,
    requestedDeliverableJson: order.requestedDeliverableJson,
  });

  const artifactType = resolveTrustArtifactType(
    deliverable.type,
    intake.normalized.desiredOutputPackage
  );

  const title =
    overrides?.title?.trim() ||
    deliverable.title?.trim() ||
    (artifactType === FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET
      ? "Trust review packet (legal review)"
      : "Smart Trust setup brief (legal review)");

  const packetMarkdown = buildFulfillmentTrustReviewPacketMarkdown({
    orderId: order.id,
    clientId: order.clientId,
    intake: intake.normalized,
    readiness: intake.readiness,
    deliverableType: artifactType,
    salesSummaryExcerpt: order.salesSummaryText?.trim().slice(0, 3000) ?? null,
  });

  return {
    clientId: order.clientId,
    title,
    packetMarkdown,
    deliverableType: artifactType,
    priority: "normal",
    fulfillmentOrderId: order.id,
    primaryService: FULFILLMENT_PRIMARY_SERVICE_TRUST,
  };
}
