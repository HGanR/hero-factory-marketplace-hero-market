import type { FulfillmentExecutiveApprovalStatus } from "@/lib/fulfillment/fulfillment-queue-dtos";
import type {
  FulfillmentDeliverableSummaryDto,
  FulfillmentPaymentConfirmationSummaryDto,
  FulfillmentQueueOrderSummaryDto,
} from "@/lib/fulfillment/fulfillment-queue-dtos";
import type {
  WebsiteIntakeNormalized,
  WebsiteIntakeReadiness,
  WebsiteIntakeReadinessTier,
} from "@/lib/fulfillment/website-intake-types";
import { FULFILLMENT_PRIMARY_SERVICE_WEBSITE } from "@/lib/fulfillment/fulfillment-types";

export type { WebsiteIntakeReadinessTier };

export type WebsiteIntakeReadinessDto = WebsiteIntakeReadiness;

export type WebsiteIntakeDetailDto = {
  normalized: WebsiteIntakeNormalized;
  readiness: WebsiteIntakeReadinessDto;
  skipperSummary: string;
  siteBuilderBriefExcerpt: string;
};

/** Recommended desk action for Skipper / executive ops (WEBSITE slice only). */
export const FULFILLMENT_NEXT_ADMIN_ACTIONS = [
  "needs_payment_confirmation",
  "ready_for_claude_handoff",
  "ready_to_propose_site_builder_draft",
  "waiting_on_approval",
  "draft_created_owner_review",
  "order_closed",
  "none",
] as const;

export type FulfillmentNextAdminAction = (typeof FULFILLMENT_NEXT_ADMIN_ACTIONS)[number];

export type FulfillmentTimelineEntryKind =
  | "payment_confirmed"
  | "claude_handoff_received"
  | "site_builder_draft_proposed"
  | "approval_created"
  | "approval_executed"
  | "stage_transition";

export type FulfillmentTimelineEntryDto = {
  id: string;
  kind: FulfillmentTimelineEntryKind;
  label: string;
  occurredAt: string;
  actorType: string | null;
  detail: string | null;
};

export type FulfillmentOrderDetailOrderDto = Omit<
  FulfillmentQueueOrderSummaryDto,
  "salesSummaryExcerpt"
> & {
  source: string;
  updatedAt: string | null;
  salesSummaryExcerpt: string | null;
  requestedDeliverable: { type: string; title: string } | null;
};

export type FulfillmentOrderDetailApprovalDto = {
  id: string;
  status: FulfillmentExecutiveApprovalStatus;
  proposedAction: string;
  createdAt: string | null;
  executedAt: string | null;
};

export type FulfillmentNextActionDto = {
  action: FulfillmentNextAdminAction;
  title: string;
  description: string;
};

export type FulfillmentOrderDetailResultDto = {
  ok: true;
  order: FulfillmentOrderDetailOrderDto;
  paymentConfirmation: FulfillmentPaymentConfirmationSummaryDto;
  deliverable: FulfillmentDeliverableSummaryDto | null;
  approval: FulfillmentOrderDetailApprovalDto | null;
  timeline: FulfillmentTimelineEntryDto[];
  nextAction: FulfillmentNextActionDto;
  websiteIntake: WebsiteIntakeDetailDto;
  meta: { primaryService: typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE };
};
