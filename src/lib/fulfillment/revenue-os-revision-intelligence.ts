import type { RevenueOsRevisionIntelligenceDto } from "@/lib/fulfillment/revenue-os-fulfillment-dtos";

export type RevisionSignalInput = {
  revisionRound: number;
  draftVersion: number;
  ownerReviewStatus: string | null;
  clientDeliveryStatus: string | null;
  pipelineStage: string;
  daysInCurrentStage: number | null;
};

export function classifyRevisionPattern(input: RevisionSignalInput): RevenueOsRevisionIntelligenceDto["pattern"] {
  if (input.revisionRound <= 0 && input.draftVersion <= 1) return "none";
  if (input.revisionRound >= 3 || input.draftVersion >= 4) return "recurring_revisions";
  if (
    input.revisionRound >= 1 &&
    (input.ownerReviewStatus === "rejected" || input.clientDeliveryStatus === "client_revision_requested")
  ) {
    return "single_revision";
  }
  if (
    input.revisionRound >= 1 &&
    input.daysInCurrentStage != null &&
    input.daysInCurrentStage >= 10 &&
    input.pipelineStage !== "released"
  ) {
    return "stalled_after_revision";
  }
  if (input.revisionRound >= 1) return "single_revision";
  return "none";
}

export function summarizeRevisionPattern(
  pattern: RevenueOsRevisionIntelligenceDto["pattern"],
  revisionRound: number
): string {
  switch (pattern) {
    case "none":
      return "No revision loop detected yet.";
    case "single_revision":
      return `Revision round ${revisionRound}: one revision cycle — owner review recommended before launch readiness.`;
    case "recurring_revisions":
      return `Revision round ${revisionRound}: recurring revisions — inspect creative/strategy alignment before launch checkpoint.`;
    case "stalled_after_revision":
      return `Revision round ${revisionRound}: stalled after revision — escalate human decision; no autonomous relaunch.`;
    default:
      return "Revision pattern unknown.";
  }
}

export function buildRevisionIntelligence(input: RevisionSignalInput): RevenueOsRevisionIntelligenceDto {
  const pattern = classifyRevisionPattern(input);
  return {
    revisionRound: input.revisionRound,
    pattern,
    summary: summarizeRevisionPattern(pattern, input.revisionRound),
  };
}
