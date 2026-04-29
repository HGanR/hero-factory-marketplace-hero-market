/**
 * Suggested posting schedule derived from batch calendar sequence (deterministic hints only).
 */

import type { RevenueOsContentBatchRole } from "@/lib/revenue-os/content-batch-routing-types";

export type RevenueOsSuggestedScheduleSlot = {
  dayIndex: number;
  role: RevenueOsContentBatchRole;
  suggestedScheduledAt?: string;
  preferredPlatforms: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type RevenueOsSuggestedScheduleTimezoneStrategy = "user_local" | "workspace_default" | "none";

export type RevenueOsSuggestedSchedulePlan = {
  slots: RevenueOsSuggestedScheduleSlot[];
  timezoneStrategy: RevenueOsSuggestedScheduleTimezoneStrategy;
  summary: string;
  /** Optional diagnostics for debug panels / Bentley transparency. */
  diagnostics?: RevenueOsSuggestedSchedulePlanDiagnostics;
};

export type RevenueOsSuggestedSchedulePlanDiagnostics = {
  slotCount: number;
  usedExactIsoTimestamps: boolean;
  timestampInterpretation: "zoned_wall_clock" | "utc_midday_neutral" | "day_order_only";
};
