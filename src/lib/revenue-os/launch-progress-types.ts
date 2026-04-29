/** 7-Day Launch Mode — persisted execution progress (client storage). */

export type RevenueOsLaunchDayExecutionStatus = "not_started" | "in_progress" | "completed" | "blocked";

export type RevenueOsLaunchDayProgress = {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  status: RevenueOsLaunchDayExecutionStatus;
  completedActions: string[];
  lastActionAt?: string;
  notes?: string;
};

/** Captured at cycle creation for stale detection (additive). */
export type RevenueOsLaunchCycleTrackingSnapshot = {
  signalMaterialKey: string;
  coreOfferNorm: string;
  audienceNorm: string;
};

export type RevenueOsLaunchCycleProgress = {
  cycleId: string;
  createdAt: string;
  updatedAt: string;
  launchPlanSummary: string;
  readinessAtCreation: {
    isReady: boolean;
    blockerCount: number;
  };
  days: RevenueOsLaunchDayProgress[];
  currentDay: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Optional — older stored cycles may omit; diff degrades gracefully. */
  trackingSnapshot?: RevenueOsLaunchCycleTrackingSnapshot;
  /** Server row id when persisted (same as cycleId after successful sync). */
  serverCycleId?: string;
};
