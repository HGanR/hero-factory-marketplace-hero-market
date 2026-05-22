import type { SmartTrustFulfillmentHandoff } from "@/lib/fulfillment/smart-trust-fulfillment-handoff";

export type ComplianceReminder = {
  id: string;
  severity: "info" | "watch" | "urgent";
  title: string;
  detail: string;
  dueHint: string | null;
};

export type ComplianceIntelligenceSummary = {
  reminders: ComplianceReminder[];
  watchCount: number;
  urgentCount: number;
  summary: string;
};

export function buildComplianceReminders(input: {
  handoff: SmartTrustFulfillmentHandoff;
  pipelineStage: string;
  daysInCurrentStage: number;
  trustOrderAtOwnerReview?: boolean;
}): ComplianceIntelligenceSummary {
  const reminders: ComplianceReminder[] = [];

  if (!input.handoff.trustId) {
    reminders.push({
      id: "link-trust",
      severity: "urgent",
      title: "Link trust workspace",
      detail: "SMART_TRUST fulfillment order missing trustId in handoff — governance timeline cannot align.",
      dueHint: "Before next governance checkpoint",
    });
  }

  if (!input.handoff.governanceReviewApprovedAt && input.pipelineStage !== "closed") {
    reminders.push({
      id: "governance-review",
      severity: "watch",
      title: "Governance review checkpoint",
      detail: "No owner-approved governance review on file. Propose governed review packet (internal note only).",
      dueHint: null,
    });
  }

  if (input.handoff.amendmentReviewRound > 0 && !input.handoff.governanceReviewApprovedAt) {
    reminders.push({
      id: "amendment-seq",
      severity: "watch",
      title: "Amendment review sequencing",
      detail:
        "Amendment review round active — complete governance review before treating amendment recommendations as ready.",
      dueHint: null,
    });
  }

  if (input.daysInCurrentStage >= 7 && input.pipelineStage !== "released" && input.pipelineStage !== "closed") {
    reminders.push({
      id: "stage-dwell",
      severity: "urgent",
      title: "Governance stage dwell",
      detail: `Order in ${input.pipelineStage} for ${input.daysInCurrentStage} days — escalate trustee coordination.`,
      dueHint: "Executive desk review",
    });
  }

  if (input.trustOrderAtOwnerReview) {
    reminders.push({
      id: "trust-parallel",
      severity: "info",
      title: "TRUST fulfillment parallel path",
      detail:
        "Client has TRUST legal-review fulfillment active — keep Smart Trust governance separate from Jarva trust apply.",
      dueHint: null,
    });
  }

  const openResolutions = input.handoff.resolutions.filter((r) => r.status !== "recorded").length;
  if (openResolutions > 0) {
    reminders.push({
      id: "open-resolutions",
      severity: "watch",
      title: "Open resolution records",
      detail: `${openResolutions} resolution(s) not recorded via governed checkpoint.`,
      dueHint: null,
    });
  }

  const watchCount = reminders.filter((r) => r.severity === "watch").length;
  const urgentCount = reminders.filter((r) => r.severity === "urgent").length;

  return {
    reminders,
    watchCount,
    urgentCount,
    summary:
      urgentCount > 0
        ? `${urgentCount} urgent compliance reminder(s); ${watchCount} watch item(s).`
        : watchCount > 0
          ? `${watchCount} watch reminder(s) — no urgent items.`
          : "No compliance reminders flagged.",
  };
}

export function weightComplianceInMemory(reminders: ComplianceReminder[]): number {
  let w = 0;
  for (const r of reminders) {
    if (r.severity === "urgent") w += 0.15;
    else if (r.severity === "watch") w += 0.08;
  }
  return Math.min(0.45, w);
}
