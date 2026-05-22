import type { SubjectMemoryHighlights } from "@/lib/executive-agent/subject-memory-context";
import type { SubjectWorkspaceScope } from "@/lib/executive-agent/subject-workspace-state";
import type {
  ClientFulfillmentOrderSnapshot,
  ClientHealthScore,
  FulfillmentRecommendation,
  UnifiedTimelineEntry,
} from "@/lib/fulfillment/fulfillment-orchestration-types";

/** Optional REVENUE_OS signals surfaced in subject workspace for Skipper. */
export type SubjectRevenueOsWorkspaceSlice = {
  campaignId: string | null;
  launchReadinessApproved: boolean;
  launchBlockerCount: number;
  pendingApproval: boolean;
} | null;

export type SubjectExecutiveWorkspaceDto = {
  ok: true;
  generatedAt: string;
  scope: SubjectWorkspaceScope;
  headline: string;
  skipperContext: string;
  timeline: UnifiedTimelineEntry[];
  timelineSummary: string | null;
  recommendations: FulfillmentRecommendation[];
  orders: ClientFulfillmentOrderSnapshot[];
  health: ClientHealthScore | null;
  memoryHighlights: SubjectMemoryHighlights | null;
  revenueOsSlice: SubjectRevenueOsWorkspaceSlice;
  skipperBrief: string | null;
  meta: {
    recommendationOnly: true;
    noAutonomousExecution: true;
    readOnlyWorkspace: true;
  };
};
