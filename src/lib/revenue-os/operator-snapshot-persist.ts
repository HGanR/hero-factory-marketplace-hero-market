/**
 * Optional persistence for operator dashboard snapshots (bentley_operator_snapshots).
 */

import crypto from "crypto";
import { getDb } from "@/lib/db";
import { bentleyOperatorSnapshots } from "@/lib/db/schema";
import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";

export type OperatorSnapshotType = "workspace_summary" | "global_summary" | "daily_digest";

export async function persistOperatorSnapshot(params: {
  userId: string;
  snapshotType: OperatorSnapshotType;
  scopeJson: Record<string, unknown>;
  summaryJson: Record<string, unknown>;
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyOperatorSnapshots).values({
      id,
      userId: params.userId,
      snapshotType: params.snapshotType,
      scopeJson: params.scopeJson,
      summaryJson: params.summaryJson,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[operator-snapshot-persist] insert failed", e);
    return { id, ok: false };
  }
}

export function overviewToSummaryJson(overview: BentleyOperatorOverview): Record<string, unknown> {
  return {
    generatedAt: overview.generatedAt,
    systemHealthScore: overview.systemHealthScore,
    globalSummary: overview.globalSummary,
    riskFlags: overview.riskFlags,
    recommendedFocus: overview.recommendedFocus,
    workspaceCount: overview.workspaceSummaries.length,
  };
}

/** Persistable JSON for executive reports (weekly/daily). */
export function executiveReportToSummaryJson(report: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: "executive_report",
    headline: report.headline,
    executiveSummary: report.executiveSummary,
    topWins: report.topWins,
    topRisks: report.topRisks,
    exceptionSummary: report.exceptionSummary,
    generatedAt: new Date().toISOString(),
  };
}
