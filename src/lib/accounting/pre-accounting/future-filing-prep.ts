/**
 * Future filing pipeline abstractions (FIRE / IRIS / information returns).
 * This release does not submit to the IRS — preparer review and human signoff only.
 */

export type FilingPrepQueueStatus = "draft" | "validation_pending" | "reviewer_hold" | "preparer_signoff" | "export_ready";

export interface InformationReturnPrepStub {
  id: string;
  kind: "1099_nec" | "1099_misc" | "w2" | "other";
  taxYear: number;
  validationStatus: "not_run" | "passed" | "failed";
  exportMappingVersion: string;
  lastReviewedAt: string | null;
  preparerSignoffRequired: true;
}
