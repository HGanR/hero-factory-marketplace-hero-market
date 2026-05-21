import { z } from "zod";
import { CreateRevenueOsCampaignReviewPacketPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import {
  FULFILLMENT_ARTIFACT_CAMPAIGN_REVIEW_PACKET,
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
} from "@/lib/fulfillment/fulfillment-types";
import { parseRevenueOsFulfillmentHandoff } from "@/lib/fulfillment/revenue-os-fulfillment-handoff";

export const REVENUE_OS_CAMPAIGN_REVIEW_NOTE_MARKER = "[Revenue OS — campaign review packet]";
export const REVENUE_OS_LAUNCH_READINESS_NOTE_MARKER = "[Revenue OS — launch readiness checkpoint]";

export const REVENUE_OS_FULFILLMENT_DISCLAIMER =
  "Governed AI Revenue OS fulfillment only. No autonomous publish, campaign launch, ad spend, deploy, or Content360 execution bypass. Owner approval required for all launch actions.";

export const REVENUE_OS_FULFILLMENT_NOTE_FOOTER =
  "---\nInternal executive note. Not client-facing. Reversible via revision loop and approval queue.";

export const ProposeRevenueOsCampaignReviewBodySchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
});

export type CampaignFulfillmentIntakeSource = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  objective: string | null;
  bentleyGenerationJson: Record<string, unknown> | null;
};

export function buildCampaignFulfillmentIntakeMarkdown(input: CampaignFulfillmentIntakeSource): string {
  const bentleyKeys = input.bentleyGenerationJson ? Object.keys(input.bentleyGenerationJson).slice(0, 12) : [];
  return `## Campaign fulfillment intake
- Campaign: ${input.campaignName} (\`${input.campaignId}\`)
- Status: ${input.campaignStatus}
- Objective: ${input.objective?.trim() || "—"}
- Bentley payload keys: ${bentleyKeys.length ? bentleyKeys.join(", ") : "none"}

### Draft review scope
Owner reviews creative/strategy packet before any launch readiness checkpoint. Content360 and platform publish remain gated by existing Bentley approvals.`;
}

export function buildCampaignReviewPacketMarkdown(input: {
  orderId: string;
  clientId: string;
  intake: CampaignFulfillmentIntakeSource;
  salesSummaryExcerpt: string | null;
  revisionRound: number;
}): string {
  const intakeMd = buildCampaignFulfillmentIntakeMarkdown(input.intake);
  const sales = input.salesSummaryExcerpt?.trim()
    ? `\n### Sales handoff excerpt\n${input.salesSummaryExcerpt.trim()}`
    : "";
  return `${intakeMd}
- Fulfillment order: \`${input.orderId}\`
- Client: \`${input.clientId}\`
- Revision round: ${input.revisionRound}
${sales}

### Review checklist (human)
1. Confirm campaign aligns with client positioning.
2. Confirm no autonomous launch or ad spend from this packet.
3. Record revisions via fulfillment revision loop if creative changes needed.`;
}

export function buildRevenueOsCampaignReviewPayloadFromOrder(
  order: {
    id: string;
    clientId: string;
    salesSummaryText: string | null;
    executiveHandoffJson?: string | null;
  },
  campaign: CampaignFulfillmentIntakeSource,
  overrides?: z.infer<typeof ProposeRevenueOsCampaignReviewBodySchema>
): z.infer<typeof CreateRevenueOsCampaignReviewPacketPayloadSchema> {
  const handoff = parseRevenueOsFulfillmentHandoff(order.executiveHandoffJson);
  const title =
    overrides?.title?.trim() ||
    `Campaign review — ${campaign.campaignName}`.slice(0, 500);
  const packetMarkdown = buildCampaignReviewPacketMarkdown({
    orderId: order.id,
    clientId: order.clientId,
    intake: campaign,
    salesSummaryExcerpt: order.salesSummaryText?.trim().slice(0, 3000) ?? null,
    revisionRound: handoff.revisionRound,
  });
  return {
    clientId: order.clientId,
    campaignId: campaign.campaignId,
    title,
    packetMarkdown,
    deliverableType: FULFILLMENT_ARTIFACT_CAMPAIGN_REVIEW_PACKET,
    priority: "normal",
    fulfillmentOrderId: order.id,
    primaryService: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  };
}

export function buildLaunchReadinessCheckpointMarkdown(input: {
  orderId: string;
  clientId: string;
  campaignId: string;
  readinessSummary: string;
  blockers: string[];
  ownerAttestation: string;
}): string {
  const blockers =
    input.blockers.length > 0
      ? input.blockers.map((b) => `- ${b}`).join("\n")
      : "- (none at checkpoint time)";
  return `## Launch readiness checkpoint (approval record only)
- Order: \`${input.orderId}\`
- Client: \`${input.clientId}\`
- Campaign: \`${input.campaignId}\`

### Readiness summary
${input.readinessSummary.trim()}

### Blockers acknowledged
${blockers}

### Owner attestation
${input.ownerAttestation.trim()}

**This checkpoint does not execute sync-launch, schedule posts, or spend ad budget.**`;
}
