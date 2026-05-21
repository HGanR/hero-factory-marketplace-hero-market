/** Client-safe DTOs for Site Builder deliverable draft review (WEBSITE slice). */

export type FulfillmentDeliverableDraftDto = {
  linked: boolean;
  clientNoteId: string | null;
  title: string | null;
  priority: string | null;
  previewText: string | null;
  ownerReviewStatus: "pending" | "approved" | "rejected";
  pipelineStage: string;
  canApprove: boolean;
  canRequestRevision: boolean;
  /** v1: internal desk only until explicit client delivery slice. */
  clientDeliveryStatus: "not_sent" | "approved_for_release";
};
