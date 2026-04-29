/**
 * Deterministic cadence / optimization rules (small-sample safe).
 */

import type { ExperimentPerformanceAnalysis } from "@/lib/revenue-os/experiment-analysis";
import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";

export const STALE_DRAFT_DAYS = 21;
export const STALE_SCHEDULED_DAYS = 14;
export const MIN_VIEWS_FOR_CONFIDENT_COMPARISON = 8;
export const MAX_PUBLISH_ATTEMPTS_BEFORE_SUPPRESS_RETRY = 4;

export function extractVariantKeyFromQueueTitle(title: string): string | null {
  const i = title.indexOf(":");
  if (i <= 0) return null;
  const k = title.slice(0, i).trim();
  return k.length ? k.slice(0, 64) : null;
}

export function isSampleLargeEnoughForPromotion(analysis: ExperimentPerformanceAnalysis | null): boolean {
  if (!analysis?.confidenceNote) return false;
  if (analysis.confidenceNote.includes("Sparse metrics") || analysis.confidenceNote.includes("No variant")) {
    return false;
  }
  return analysis.winningVariants.length > 0;
}

export function shouldPromoteWinner(input: {
  queueItem: DistributionQueueRow;
  analysis: ExperimentPerformanceAnalysis | null;
  connectorReady: boolean;
}): boolean {
  const { queueItem, analysis, connectorReady } = input;
  if (!connectorReady) return false;
  if (queueItem.suppressionReason?.trim()) return false;
  if (queueItem.queueStatus === "published" || queueItem.queueStatus === "archived") return false;
  if (!analysis?.winningVariants.length) return false;
  if (!isSampleLargeEnoughForPromotion(analysis)) return false;
  const vk = extractVariantKeyFromQueueTitle(queueItem.title);
  if (!vk) return false;
  return analysis.winningVariants.includes(vk);
}

export function shouldSuppressLoser(input: {
  queueItem: DistributionQueueRow;
  analysis: ExperimentPerformanceAnalysis | null;
}): boolean {
  const { queueItem, analysis } = input;
  if (queueItem.promotionReason?.trim()) return false;
  if (queueItem.queueStatus === "published" || queueItem.queueStatus === "archived") return false;
  if (!analysis?.losingVariants.length) return false;
  const vk = extractVariantKeyFromQueueTitle(queueItem.title);
  if (!vk) return false;
  return analysis.losingVariants.includes(vk);
}

export function shouldRetryFailedPublish(input: {
  queueItem: DistributionQueueRow;
  connectorReady: boolean;
}): boolean {
  const { queueItem, connectorReady } = input;
  if (queueItem.queueStatus !== "failed") return false;
  if (!connectorReady) return false;
  if ((queueItem.publishAttemptCount ?? 0) >= MAX_PUBLISH_ATTEMPTS_BEFORE_SUPPRESS_RETRY) return false;
  if (queueItem.suppressionReason?.trim()) return false;
  return true;
}

export function shouldArchiveStaleAsset(input: {
  queueItem: DistributionQueueRow;
  nowMs: number;
}): boolean {
  const q = input.queueItem;
  if (q.queueStatus !== "draft" && q.queueStatus !== "failed" && q.queueStatus !== "scheduled") return false;
  const created = q.createdAt instanceof Date ? q.createdAt.getTime() : new Date(q.createdAt).getTime();
  const ageDays = (input.nowMs - created) / (86400 * 1000);
  if (q.queueStatus === "scheduled" && q.scheduledFor) {
    const sf = q.scheduledFor instanceof Date ? q.scheduledFor.getTime() : new Date(q.scheduledFor).getTime();
    if (sf < input.nowMs - 7 * 86400 * 1000) return true;
  }
  if (q.queueStatus === "draft" && ageDays > STALE_DRAFT_DAYS) return true;
  if (q.queueStatus === "failed" && ageDays > STALE_DRAFT_DAYS) return true;
  return false;
}

export function shouldRetestAngle(input: {
  queueItem: DistributionQueueRow;
  analysis: ExperimentPerformanceAnalysis | null;
  weakConfidence: boolean;
}): boolean {
  if (input.queueItem.queueStatus === "published" || input.queueItem.queueStatus === "archived") return false;
  if (input.weakConfidence && input.analysis?.confidenceNote.includes("provisional")) return true;
  return false;
}

export function scoreCadencePriority(input: {
  queueItem: DistributionQueueRow;
  isWinner: boolean;
  isLoser: boolean;
  leadSignalSummary: LeadSignalSummary | null | undefined;
}): number {
  let s = input.queueItem.publishPriority ?? input.queueItem.cadencePriority ?? 5;
  if (input.isWinner) s += 3;
  if (input.isLoser) s -= 2;
  const ls = input.leadSignalSummary;
  if (ls && ls.highIntentSignals > 2) s += 1;
  if (ls && ls.handoffReadyLeads > 2) s += 1;
  return Math.max(1, Math.min(10, Math.round(s)));
}

export function connectorReadinessForQueueItem(
  queueItem: DistributionQueueRow,
  coverage: ConnectorCoverageSummary | null | undefined
): boolean {
  if (!coverage) return false;
  if (coverage.blockedTargetsCount && coverage.autoPublishReadyCount === 0) {
    const p = (queueItem.platform ?? "").toLowerCase();
    return coverage.connectedPlatforms.some((c) => p.includes(c));
  }
  return (coverage.autoPublishReadyCount ?? 0) > 0 || (coverage.connectedPlatforms?.length ?? 0) > 0;
}
