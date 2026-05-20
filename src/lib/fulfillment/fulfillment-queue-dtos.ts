import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";
import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  FULFILLMENT_DEPARTMENT_SITE_BUILDER,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
  type FulfillmentPipelineStage,
} from "@/lib/fulfillment/fulfillment-types";

const SALES_SUMMARY_EXCERPT_MAX = 240;

/** Executive Site Builder task approval linked to an order (read-only visibility). */
export type FulfillmentExecutiveApprovalStatus = ExecutiveApprovalStatus | "none";

export type FulfillmentPaymentConfirmationSummaryDto = {
  id: string;
  status: "pending" | "confirmed" | "failed";
  provider: string;
  confirmedAt: string | null;
  consumedAt: string | null;
  consumedByOrderId: string | null;
  externalRefMasked: string | null;
};

export type FulfillmentDeliverableSummaryDto = {
  id: string;
  department: string;
  artifactType: string;
  ownerReviewStatus: "pending" | "approved" | "rejected";
  artifactRef: string | null;
};

export type FulfillmentQueueOrderSummaryDto = {
  orderId: string;
  clientId: string;
  pipelineStage: FulfillmentPipelineStage | string;
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  approvalId: string | null;
  proposedAction: string | null;
  paymentConfirmation: FulfillmentPaymentConfirmationSummaryDto;
  createdAt: string;
  salesSummaryExcerpt: string | null;
  deliverable: FulfillmentDeliverableSummaryDto | null;
  assignedDepartment: string;
  service: { primary: typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE };
};

export type FulfillmentQueueListResultDto = {
  ok: true;
  orders: FulfillmentQueueOrderSummaryDto[];
  meta: {
    limit: number;
    returned: number;
    stageFilter: string | null;
    approvalFilter: string | null;
    primaryService: typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
  };
};

export function maskPaymentExternalRef(ref: string | null | undefined): string | null {
  const t = ref?.trim();
  if (!t) return null;
  if (t.length <= 4) return "****";
  return `***${t.slice(-4)}`;
}

export function buildSalesSummaryExcerpt(text: string | null | undefined): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const redacted = redactSensitiveIntakeText(raw);
  if (redacted.length <= SALES_SUMMARY_EXCERPT_MAX) return redacted;
  return `${redacted.slice(0, SALES_SUMMARY_EXCERPT_MAX - 1)}…`;
}

export function toIso(d: Date | null | undefined): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export const FULFILLMENT_QUEUE_APPROVAL_FILTERS = [
  "none",
  "pending",
  "approved",
  "rejected",
  "executed",
  "failed",
] as const;

export type FulfillmentQueueApprovalFilter = (typeof FULFILLMENT_QUEUE_APPROVAL_FILTERS)[number];

export function isFulfillmentQueueApprovalFilter(v: string): v is FulfillmentQueueApprovalFilter {
  return (FULFILLMENT_QUEUE_APPROVAL_FILTERS as readonly string[]).includes(v);
}

/** v1 queue is Site Builder / WEBSITE only. */
export function assertWebsiteQueueDepartment(department: string): boolean {
  return department === FULFILLMENT_DEPARTMENT_SITE_BUILDER;
}
