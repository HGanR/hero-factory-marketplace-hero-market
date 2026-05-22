import { randomUUID } from "crypto";
import type {
  SmartTrustFulfillmentHandoff,
  SmartTrustResolutionRecord,
} from "@/lib/fulfillment/smart-trust-fulfillment-handoff";

export type ResolutionTrackingSummary = {
  total: number;
  draft: number;
  proposed: number;
  recorded: number;
  openActions: string[];
  timeline: Array<{ at: string; label: string; resolutionId: string }>;
};

export function summarizeResolutionTracking(handoff: SmartTrustFulfillmentHandoff): ResolutionTrackingSummary {
  const resolutions = handoff.resolutions ?? [];
  const draft = resolutions.filter((r) => r.status === "draft").length;
  const proposed = resolutions.filter((r) => r.status === "proposed").length;
  const recorded = resolutions.filter((r) => r.status === "recorded").length;
  const openActions: string[] = [];
  if (resolutions.some((r) => r.status === "draft")) {
    openActions.push("Draft resolutions exist — propose governed record checkpoint before treating as final.");
  }
  if (resolutions.some((r) => r.status === "proposed")) {
    openActions.push("Resolution record approval pending — minutes not finalized in audit trail.");
  }

  const timeline = resolutions
    .filter((r) => r.recordedAt)
    .map((r) => ({
      at: r.recordedAt!,
      label: `Resolution recorded: ${r.title}`,
      resolutionId: r.id,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    total: resolutions.length,
    draft,
    proposed,
    recorded,
    openActions,
    timeline,
  };
}

export function buildResolutionRecordMarkdown(input: {
  orderId: string;
  clientId: string;
  trustId: string | null;
  resolutionTitle: string;
  minutesSummary: string;
  amendmentContext: string | null;
}): string {
  return [
    "# Trust resolution / minutes record (governed)",
    "",
    "Internal checkpoint only. Does not file, sign, or apply trust amendments.",
    "",
    `Order: ${input.orderId}`,
    `Client: ${input.clientId}`,
    `Trust: ${input.trustId ?? "(not linked)"}`,
    `Resolution: ${input.resolutionTitle}`,
    "",
    "## Minutes summary",
    input.minutesSummary.trim(),
    "",
    "## Amendment context",
    input.amendmentContext?.trim() || "(none — informational only)",
  ]
    .join("\n")
    .slice(0, 100_000);
}

export function appendProposedResolution(
  handoff: SmartTrustFulfillmentHandoff,
  input: { title: string; minutesSummary: string }
): SmartTrustResolutionRecord {
  const record: SmartTrustResolutionRecord = {
    id: randomUUID(),
    title: input.title.trim().slice(0, 500) || "Governance resolution",
    status: "proposed",
    minutesSummary: input.minutesSummary.trim().slice(0, 20_000) || null,
    recordedAt: null,
  };
  return record;
}

