/** Parses SMART_TRUST fulfillment handoff stored on client_service_orders.executiveHandoffJson. */

export type SmartTrustResolutionRecord = {
  id: string;
  title: string;
  status: "draft" | "proposed" | "recorded";
  minutesSummary: string | null;
  recordedAt: string | null;
};

export type SmartTrustFulfillmentHandoff = {
  trustId: string | null;
  intakeKind: string | null;
  governanceReviewRound: number;
  amendmentReviewRound: number;
  trusteeWorkflowState: string | null;
  lastGovernanceReviewApprovalId: string | null;
  lastResolutionRecordApprovalId: string | null;
  governanceReviewApprovedAt: string | null;
  resolutions: SmartTrustResolutionRecord[];
  complianceRemindersAckAt: string | null;
};

export function parseSmartTrustFulfillmentHandoff(
  json: string | null | undefined
): SmartTrustFulfillmentHandoff {
  const empty: SmartTrustFulfillmentHandoff = {
    trustId: null,
    intakeKind: null,
    governanceReviewRound: 0,
    amendmentReviewRound: 0,
    trusteeWorkflowState: null,
    lastGovernanceReviewApprovalId: null,
    lastResolutionRecordApprovalId: null,
    governanceReviewApprovedAt: null,
    resolutions: [],
    complianceRemindersAckAt: null,
  };
  if (!json?.trim()) return empty;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const resolutions = Array.isArray(v.resolutions)
      ? v.resolutions
          .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
          .map((r) => ({
            id: typeof r.id === "string" ? r.id : "",
            title: typeof r.title === "string" ? r.title : "Resolution",
            status:
              r.status === "proposed" || r.status === "recorded" || r.status === "draft"
                ? r.status
                : "draft",
            minutesSummary: typeof r.minutesSummary === "string" ? r.minutesSummary : null,
            recordedAt: typeof r.recordedAt === "string" ? r.recordedAt : null,
          }))
          .filter((r) => r.id)
      : [];
    return {
      trustId: typeof v.trustId === "string" && v.trustId.trim() ? v.trustId.trim() : null,
      intakeKind: typeof v.intakeKind === "string" ? v.intakeKind : null,
      governanceReviewRound:
        typeof v.governanceReviewRound === "number" && Number.isFinite(v.governanceReviewRound)
          ? v.governanceReviewRound
          : 0,
      amendmentReviewRound:
        typeof v.amendmentReviewRound === "number" && Number.isFinite(v.amendmentReviewRound)
          ? v.amendmentReviewRound
          : 0,
      trusteeWorkflowState:
        typeof v.trusteeWorkflowState === "string" ? v.trusteeWorkflowState : null,
      lastGovernanceReviewApprovalId:
        typeof v.lastGovernanceReviewApprovalId === "string" ? v.lastGovernanceReviewApprovalId : null,
      lastResolutionRecordApprovalId:
        typeof v.lastResolutionRecordApprovalId === "string"
          ? v.lastResolutionRecordApprovalId
          : null,
      governanceReviewApprovedAt:
        typeof v.governanceReviewApprovedAt === "string" ? v.governanceReviewApprovedAt : null,
      resolutions,
      complianceRemindersAckAt:
        typeof v.complianceRemindersAckAt === "string" ? v.complianceRemindersAckAt : null,
    };
  } catch {
    return empty;
  }
}

export function mergeSmartTrustFulfillmentHandoff(
  current: string | null | undefined,
  patch: Partial<SmartTrustFulfillmentHandoff>
): string {
  const base = parseSmartTrustFulfillmentHandoff(current);
  return JSON.stringify({ ...base, ...patch }).slice(0, 50_000);
}

export function markResolutionRecorded(
  resolutions: SmartTrustResolutionRecord[],
  resolutionId: string,
  recordedAt: string
): SmartTrustResolutionRecord[] {
  return resolutions.map((r) =>
    r.id === resolutionId ? { ...r, status: "recorded" as const, recordedAt } : r
  );
}
