/**
 * Timeline-friendly deployment history across policy families (change sets + runs).
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyPolicyChangeSets, bentleyPolicyChangeSetRuns } from "@/lib/db/schema";
import {
  listPolicyChangeSetsForUser,
  listChangeSetRuns,
  type PolicyChangeSetRow,
  type PolicyChangeSetRunRow,
} from "@/lib/revenue-os/policy-change-sets-db";
import { getPolicyRollbackPackageByIdForUser } from "@/lib/revenue-os/policy-rollback-db";

export type DeploymentHistoryEntry = {
  changeSet: PolicyChangeSetRow;
  latestRun: PolicyChangeSetRunRow | null;
  linkedRollbackPackageId: string | null;
};

export async function listBentleyPolicyDeployments(input: {
  userId: string;
  limit?: number;
  /** Filter by terminal-ish statuses */
  statusIn?: string[];
}): Promise<DeploymentHistoryEntry[]> {
  const uid = String(input.userId).trim();
  if (!uid) return [];
  const lim = Math.min(Math.max(input.limit ?? 40, 1), 200);
  const rows = await listPolicyChangeSetsForUser({ userId: uid, limit: lim });
  const filtered = input.statusIn?.length
    ? rows.filter((r) => input.statusIn!.includes(String(r.status)))
    : rows;

  const out: DeploymentHistoryEntry[] = [];
  for (const cs of filtered) {
    const runs = await listChangeSetRuns({ changeSetId: cs.id, limit: 1 });
    const latestRun = runs[0] ?? null;
    out.push({
      changeSet: cs,
      latestRun,
      linkedRollbackPackageId: cs.sourceRollbackPackageId?.trim() || null,
    });
  }
  return out;
}

export type DeploymentHistorySummary = {
  recentSuccessful: number;
  recentFailures: number;
  recentPartialApplies: number;
  recentRollbackDeploys: number;
  /** Short narrative lines for GrowthGuidance / notes. */
  lines: string[];
};

export async function summarizeBentleyPolicyDeploymentHistory(input: {
  userId: string;
  lookback?: number;
}): Promise<DeploymentHistorySummary> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      recentSuccessful: 0,
      recentFailures: 0,
      recentPartialApplies: 0,
      recentRollbackDeploys: 0,
      lines: [],
    };
  }
  const n = Math.min(Math.max(input.lookback ?? 15, 1), 100);
  const rows = await listPolicyChangeSetsForUser({ userId: uid, limit: n });

  let recentSuccessful = 0;
  let recentFailures = 0;
  let recentPartialApplies = 0;
  let recentRollbackDeploys = 0;

  for (const cs of rows) {
    if (cs.changeSetType === "rollback_deploy") recentRollbackDeploys += 1;
    if (cs.status === "completed") recentSuccessful += 1;
    else if (cs.status === "failed") recentFailures += 1;
    else if (cs.status === "partially_applied") recentPartialApplies += 1;
  }

  const lines: string[] = [];
  if (recentPartialApplies > 0) {
    lines.push(`${recentPartialApplies} recent deployment(s) finished with partial applies — review failed items.`);
  }
  if (recentSuccessful > 0 && recentFailures === 0 && recentPartialApplies === 0) {
    lines.push(`${recentSuccessful} recent coordinated deployment(s) completed successfully.`);
  }
  if (recentRollbackDeploys > 0) {
    lines.push(`${recentRollbackDeploys} rollback-anchored change set(s) in recent history.`);
  }

  return {
    recentSuccessful,
    recentFailures,
    recentPartialApplies,
    recentRollbackDeploys,
    lines,
  };
}

export async function getBentleyLatestPolicyDeployment(input: { userId: string }): Promise<DeploymentHistoryEntry | null> {
  const uid = String(input.userId).trim();
  if (!uid) return null;
  const rows = await listPolicyChangeSetsForUser({ userId: uid, limit: 1 });
  const cs = rows[0];
  if (!cs) return null;
  const runs = await listChangeSetRuns({ changeSetId: cs.id, limit: 1 });
  return {
    changeSet: cs,
    latestRun: runs[0] ?? null,
    linkedRollbackPackageId: cs.sourceRollbackPackageId?.trim() || null,
  };
}

/** Enrich rollback linkage when a deployment references a saved package. */
export async function describeRollbackLinkageForChangeSet(input: {
  userId: string;
  changeSetId: string;
}): Promise<{ rollbackPackageId: string | null; packageName: string | null; line: string }> {
  const uid = String(input.userId).trim();
  const cs = (await listPolicyChangeSetsForUser({ userId: uid, limit: 200 })).find((c) => c.id === input.changeSetId);
  const pid = cs?.sourceRollbackPackageId?.trim();
  if (!pid) {
    return { rollbackPackageId: null, packageName: null, line: "No rollback package linked to this change set." };
  }
  const pkg = await getPolicyRollbackPackageByIdForUser({ userId: uid, packageId: pid });
  const name = pkg?.name?.trim() || null;
  return {
    rollbackPackageId: pid,
    packageName: name,
    line: name
      ? `Rollback package "${name.slice(0, 80)}" remains available for this lineage.`
      : "Rollback package remains available for the latest change set.",
  };
}

/** Find a run row that references a change set (for cross-links). */
export async function findChangeSetRunByIdForUser(input: {
  userId: string;
  runId: string;
}): Promise<{ run: PolicyChangeSetRunRow; changeSet: PolicyChangeSetRow } | null> {
  const uid = String(input.userId).trim();
  const rid = String(input.runId).trim();
  if (!uid || !rid) return null;
  try {
    const db = await getDb();
    const rRows = await db
      .select()
      .from(bentleyPolicyChangeSetRuns)
      .where(eq(bentleyPolicyChangeSetRuns.id, rid))
      .limit(1);
    const run = rRows[0];
    if (!run) return null;
    const cRows = await db
      .select()
      .from(bentleyPolicyChangeSets)
      .where(eq(bentleyPolicyChangeSets.id, run.changeSetId))
      .limit(1);
    const cs = cRows[0];
    if (!cs || cs.userId !== uid) return null;
    return { run, changeSet: cs };
  } catch {
    return null;
  }
}
