import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  buildSalesSummaryExcerpt,
  FULFILLMENT_QUEUE_APPROVAL_FILTERS,
  isFulfillmentQueueApprovalFilter,
  maskPaymentExternalRef,
  toIso,
  type FulfillmentExecutiveApprovalStatus,
  type FulfillmentPaymentConfirmationSummaryDto,
  type FulfillmentQueueApprovalFilter,
} from "@/lib/fulfillment/fulfillment-queue-dtos";
import type { FulfillmentPipelineStage } from "@/lib/fulfillment/fulfillment-types";
import { FULFILLMENT_PRIMARY_SERVICE_TRUST } from "@/lib/fulfillment/fulfillment-types";

export {
  buildSalesSummaryExcerpt,
  FULFILLMENT_QUEUE_APPROVAL_FILTERS,
  isFulfillmentQueueApprovalFilter,
  maskPaymentExternalRef,
  toIso,
};
export type { FulfillmentExecutiveApprovalStatus, FulfillmentQueueApprovalFilter };

export type TrustFulfillmentDeliverableSummaryDto = {
  id: string;
  department: string;
  artifactType: string;
  ownerReviewStatus: "pending" | "approved" | "rejected";
  artifactRef: string | null;
};

export type TrustFulfillmentQueueOrderSummaryDto = {
  orderId: string;
  clientId: string;
  pipelineStage: FulfillmentPipelineStage | string;
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  approvalId: string | null;
  proposedAction: string | null;
  paymentConfirmation: FulfillmentPaymentConfirmationSummaryDto;
  createdAt: string;
  salesSummaryExcerpt: string | null;
  deliverable: TrustFulfillmentDeliverableSummaryDto | null;
  assignedDepartment: string;
  service: { primary: typeof FULFILLMENT_PRIMARY_SERVICE_TRUST };
};

export type TrustFulfillmentQueueListResultDto = {
  ok: true;
  orders: TrustFulfillmentQueueOrderSummaryDto[];
  meta: {
    limit: number;
    returned: number;
    stageFilter: string | null;
    approvalFilter: string | null;
    primaryService: typeof FULFILLMENT_PRIMARY_SERVICE_TRUST;
  };
};

export function assertTrustQueueDepartment(department: string): boolean {
  return department === "trust_records";
}
