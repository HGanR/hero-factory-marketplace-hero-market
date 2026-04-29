/**
 * Calendar-style ordering for routed content batches (deterministic; no I/O).
 */

import type { RevenueOsContentBatchRole } from "@/lib/revenue-os/content-batch-routing-types";

export type RevenueOsBatchSequenceSlot = {
  dayIndex: number;
  role: RevenueOsContentBatchRole;
  preferredPlatforms: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
  itemIds?: string[];
};

export type RevenueOsBatchCalendarSequence = {
  slots: RevenueOsBatchSequenceSlot[];
  sequencingStrategy: string;
  summary: string;
  /** Optional diagnostics for UI debug / Bentley transparency. */
  diagnostics?: RevenueOsBatchCalendarSequenceDiagnostics;
};

export type RevenueOsBatchCalendarSequenceDiagnostics = {
  slotCount: number;
  rolesOmittedLowSignal: RevenueOsContentBatchRole[];
  leadCaptureSuppressed: boolean;
  launchAlignmentApplied: boolean;
  authorityFirstApplied: boolean;
};
