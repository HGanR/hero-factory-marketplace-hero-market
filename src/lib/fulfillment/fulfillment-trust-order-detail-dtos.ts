import type { FulfillmentExecutiveApprovalStatus } from "@/lib/fulfillment/fulfillment-trust-queue-dtos";
import type {
  TrustFulfillmentDeliverableSummaryDto,
  TrustFulfillmentQueueOrderSummaryDto,
} from "@/lib/fulfillment/fulfillment-trust-queue-dtos";
import type { FulfillmentPaymentConfirmationSummaryDto } from "@/lib/fulfillment/fulfillment-queue-dtos";
import type { TrustFulfillmentDeliverableDraftDto } from "@/lib/fulfillment/fulfillment-trust-deliverable-draft-dtos";
import type {
  TrustIntakeNormalized,
  TrustIntakeReadiness,
} from "@/lib/fulfillment/trust-intake-types";
import { FULFILLMENT_PRIMARY_SERVICE_TRUST } from "@/lib/fulfillment/fulfillment-types";
import {
  TRUST_FULFILLMENT_LEGAL_BANNER,
  TRUST_FULFILLMENT_SKIPPER_WARNING,
} from "@/lib/fulfillment/fulfillment-trust-legal";

export const TRUST_FULFILLMENT_NEXT_ADMIN_ACTIONS = [
  "needs_payment_confirmation",
  "ready_for_claude_handoff",
  "ready_to_propose_trust_packet",
  "waiting_on_approval",
  "trust_packet_owner_review",
  "trust_packet_approved_internal",
  "order_closed",
  "none",
] as const;

export type TrustFulfillmentNextAdminAction = (typeof TRUST_FULFILLMENT_NEXT_ADMIN_ACTIONS)[number];

export type TrustFulfillmentTimelineEntryKind =
  | "payment_confirmed"
  | "claude_handoff_received"
  | "trust_packet_proposed"
  | "approval_created"
  | "approval_executed"
  | "trust_packet_linked"
  | "trust_packet_approved_for_release"
  | "trust_packet_revision_requested"
  | "stage_transition";

export type TrustFulfillmentTimelineEntryDto = {
  id: string;
  kind: TrustFulfillmentTimelineEntryKind;
  label: string;
  occurredAt: string;
  actorType: string | null;
  detail: string | null;
};

export type TrustFulfillmentOrderDetailOrderDto = Omit<
  TrustFulfillmentQueueOrderSummaryDto,
  "salesSummaryExcerpt"
> & {
  source: string;
  updatedAt: string | null;
  salesSummaryExcerpt: string | null;
  requestedDeliverable: { type: string; title: string } | null;
};

export type TrustFulfillmentOrderDetailApprovalDto = {
  id: string;
  status: FulfillmentExecutiveApprovalStatus;
  proposedAction: string;
  createdAt: string | null;
  executedAt: string | null;
};

export type TrustFulfillmentNextActionDto = {
  action: TrustFulfillmentNextAdminAction;
  title: string;
  description: string;
};

export type TrustIntakeDetailDto = {
  normalized: TrustIntakeNormalized;
  readiness: TrustIntakeReadiness;
  skipperSummary: string;
};

export type TrustFulfillmentOrderDetailResultDto = {
  ok: true;
  order: TrustFulfillmentOrderDetailOrderDto;
  paymentConfirmation: FulfillmentPaymentConfirmationSummaryDto;
  deliverable: TrustFulfillmentDeliverableSummaryDto | null;
  approval: TrustFulfillmentOrderDetailApprovalDto | null;
  timeline: TrustFulfillmentTimelineEntryDto[];
  nextAction: TrustFulfillmentNextActionDto;
  trustIntake: TrustIntakeDetailDto;
  deliverableDraft: TrustFulfillmentDeliverableDraftDto | null;
  legal: {
    banner: typeof TRUST_FULFILLMENT_LEGAL_BANNER;
    skipperWarning: typeof TRUST_FULFILLMENT_SKIPPER_WARNING;
  };
  meta: { primaryService: typeof FULFILLMENT_PRIMARY_SERVICE_TRUST };
};
