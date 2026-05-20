import { z } from "zod";
import { CreateSiteBuilderTaskPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";

export const ProposeSiteBuilderDraftBodySchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  instruction: z.string().trim().min(1).max(20_000).optional(),
  pageSlug: z.string().trim().max(191).optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export type FulfillmentOrderPayloadSource = {
  clientId: string;
  salesSummaryText: string | null;
  requestedDeliverableJson: string | null;
};

function parseRequestedDeliverable(json: string | null): {
  title?: string;
  notes?: string;
  dueHint?: string | null;
} {
  if (!json?.trim()) return {};
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    return {
      title: typeof v.title === "string" ? v.title : undefined,
      notes: typeof v.notes === "string" ? v.notes : undefined,
      dueHint: typeof v.dueHint === "string" ? v.dueHint : null,
    };
  } catch {
    return {};
  }
}

/** Builds internal Site Builder task payload — draft note only after approval executes. */
export function buildSiteBuilderTaskPayloadFromOrder(
  order: FulfillmentOrderPayloadSource,
  overrides?: z.infer<typeof ProposeSiteBuilderDraftBodySchema>
): z.infer<typeof CreateSiteBuilderTaskPayloadSchema> {
  const deliverable = parseRequestedDeliverable(order.requestedDeliverableJson);
  const title =
    overrides?.title?.trim() ||
    deliverable.title?.trim() ||
    "Site Builder fulfillment package";

  const summary = order.salesSummaryText?.trim() ?? "";
  const notes = deliverable.notes?.trim() ?? "";
  const due = deliverable.dueHint?.trim();
  const defaultInstruction = [
    "[Fulfillment — Site Builder draft intake]",
    summary ? `Sales summary:\n${summary}` : null,
    notes ? `Deliverable notes:\n${notes}` : null,
    due ? `Due hint: ${due}` : null,
    "",
    "On approval: internal client note only. No deploy, publish, or email send.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const instruction = overrides?.instruction?.trim() || defaultInstruction;

  return {
    clientId: order.clientId,
    title,
    instruction: instruction.slice(0, 20_000),
    pageSlug: overrides?.pageSlug ?? null,
    priority: overrides?.priority ?? "normal",
  };
}
