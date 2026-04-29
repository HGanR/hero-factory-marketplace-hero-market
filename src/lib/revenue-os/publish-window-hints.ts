/**
 * Deterministic publish window hints (upgradeable to real scheduling later).
 */

import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";

export type PublishWindowHint = {
  queueId: string;
  platform: string;
  suggestedWindowLabel: string;
  urgency: "low" | "medium" | "high";
  rationale: string;
};

export type BuildPublishWindowHintsInput = {
  queueItems: DistributionQueueRow[];
  publishingObjective: string | null | undefined;
  connectorCoverage: ConnectorCoverageSummary | null | undefined;
  experimentActive: boolean;
};

export function buildPublishWindowHints(input: BuildPublishWindowHintsInput): PublishWindowHint[] {
  const hints: PublishWindowHint[] = [];
  const cc = input.connectorCoverage;
  const ready = (cc?.autoPublishReadyCount ?? 0) > 0;

  for (const q of input.queueItems) {
    if (q.queueStatus === "published" || q.queueStatus === "archived") continue;
    const p = (q.platform ?? "").toLowerCase();
    let window = "Business hours local (10:00–14:00)";
    if (p.includes("tiktok") || p.includes("instagram")) window = "Evening scroll window (18:00–21:00 local)";
    if (p.includes("linkedin")) window = "Weekday mornings (08:00–11:00 local)";
    if (p.includes("youtube")) window = "Weekend daytime for long-form; Shorts anytime";

    let urgency: PublishWindowHint["urgency"] = "medium";
    if (input.publishingObjective === "publish_now" || q.publishPriority != null && q.publishPriority >= 8) {
      urgency = "high";
    }
    if (!ready && (cc?.manualFallbackCount ?? 0) > 0) urgency = "low";

    let rationale = "Default platform cadence.";
    if (input.experimentActive) rationale += " Experiment active — align posts with measurement windows.";
    if (!ready) rationale += " Connector backlog — prefer manual slot until OAuth path clears.";

    hints.push({
      queueId: q.id,
      platform: q.platform,
      suggestedWindowLabel: window,
      urgency,
      rationale,
    });
    if (hints.length >= 40) break;
  }
  return hints;
}
