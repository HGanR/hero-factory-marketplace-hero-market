/** TRUST fulfillment deliverable draft review DTOs. */

export type TrustFulfillmentDeliverableDraftDto = {
  linked: boolean;
  clientNoteId: string | null;
  title: string | null;
  priority: string | null;
  packetType: string | null;
  previewText: string | null;
  hasLegalDisclaimer: boolean;
  ownerReviewStatus: "pending" | "approved" | "rejected";
  pipelineStage: string;
  canApprove: boolean;
  canRequestRevision: boolean;
};
