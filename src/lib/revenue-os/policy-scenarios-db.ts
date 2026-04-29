/**
 * Persistence for policy tuning workbench scenarios and dry-run run outputs.
 */

import crypto from "crypto";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyPolicyScenarioRuns, bentleyPolicyScenarios } from "@/lib/db/schema";

export type PolicyScenarioRow = typeof bentleyPolicyScenarios.$inferSelect;
export type PolicyScenarioRunRow = typeof bentleyPolicyScenarioRuns.$inferSelect;

export type BentleyPolicyScenarioType =
  | "autonomous"
  | "cadence"
  | "notifications"
  | "blended";

export function scenarioScopeMatches(
  row: Pick<PolicyScenarioRow, "userId" | "clientId" | "trustId">,
  userId: string,
  clientId?: string | null,
  trustId?: string | null
): boolean {
  if (String(row.userId) !== String(userId)) return false;
  const c = clientId?.trim() ?? "";
  const t = trustId?.trim() ?? "";
  const rc = row.clientId?.trim() ?? "";
  const rt = row.trustId?.trim() ?? "";
  if (c === "" && t === "") return true;
  return rc === c && rt === t;
}

export async function insertPolicyScenario(params: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
  scenarioType: BentleyPolicyScenarioType;
  name: string;
  description?: string | null;
  basePolicySnapshotJson?: Record<string, unknown> | null;
  proposedPolicySnapshotJson?: Record<string, unknown> | null;
  isSaved: boolean;
  id?: string;
}): Promise<PolicyScenarioRow | null> {
  const uid = String(params.userId).trim();
  if (!uid) return null;
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyPolicyScenarios).values({
      id,
      userId: uid,
      clientId: params.clientId?.trim() || null,
      trustId: params.trustId?.trim() || null,
      scenarioType: params.scenarioType,
      name: params.name.slice(0, 255),
      description: params.description?.trim() || null,
      basePolicySnapshotJson: params.basePolicySnapshotJson ?? null,
      proposedPolicySnapshotJson: params.proposedPolicySnapshotJson ?? null,
      isSaved: params.isSaved,
    });
    const rows = await db.select().from(bentleyPolicyScenarios).where(eq(bentleyPolicyScenarios.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.warn("[policy-scenarios-db] insert failed", e);
    return null;
  }
}

export async function insertPolicyScenarioRun(params: {
  scenarioId: string;
  runStatus: "completed" | "failed" | "partial";
  comparisonJson?: Record<string, unknown> | null;
  riskSummaryJson?: Record<string, unknown> | null;
  recommendationJson?: Record<string, unknown> | null;
  id?: string;
}): Promise<PolicyScenarioRunRow | null> {
  const sid = String(params.scenarioId).trim();
  if (!sid) return null;
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyPolicyScenarioRuns).values({
      id,
      scenarioId: sid,
      runStatus: params.runStatus,
      comparisonJson: params.comparisonJson ?? null,
      riskSummaryJson: params.riskSummaryJson ?? null,
      recommendationJson: params.recommendationJson ?? null,
    });
    const rows = await db.select().from(bentleyPolicyScenarioRuns).where(eq(bentleyPolicyScenarioRuns.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.warn("[policy-scenarios-db] insert run failed", e);
    return null;
  }
}

function scopeWhere(
  userId: string,
  clientId?: string | null,
  trustId?: string | null
) {
  const uid = String(userId).trim();
  const c = clientId?.trim() ?? "";
  const t = trustId?.trim() ?? "";
  if (c === "" && t === "") {
    return eq(bentleyPolicyScenarios.userId, uid);
  }
  const globalScope = or(
    and(isNull(bentleyPolicyScenarios.clientId), isNull(bentleyPolicyScenarios.trustId)),
    and(eq(bentleyPolicyScenarios.clientId, ""), eq(bentleyPolicyScenarios.trustId, ""))
  );
  return and(
    eq(bentleyPolicyScenarios.userId, uid),
    or(and(eq(bentleyPolicyScenarios.clientId, c), eq(bentleyPolicyScenarios.trustId, t)), globalScope)
  );
}

export async function listPolicyScenariosForUser(params: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
  limit?: number;
  savedOnly?: boolean;
}): Promise<PolicyScenarioRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const lim = Math.min(Math.max(params.limit ?? 50, 1), 200);
  try {
    const db = await getDb();
    const w = scopeWhere(uid, params.clientId, params.trustId);
    const q = db
      .select()
      .from(bentleyPolicyScenarios)
      .where(
        params.savedOnly
          ? and(w, eq(bentleyPolicyScenarios.isSaved, true))
          : w
      )
      .orderBy(desc(bentleyPolicyScenarios.updatedAt))
      .limit(lim);
    return await q;
  } catch (e) {
    console.warn("[policy-scenarios-db] list failed", e);
    return [];
  }
}

export async function getPolicyScenarioByIdForUser(params: {
  userId: string;
  scenarioId: string;
}): Promise<PolicyScenarioRow | null> {
  const uid = String(params.userId).trim();
  const id = String(params.scenarioId).trim();
  if (!uid || !id) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyPolicyScenarios)
      .where(and(eq(bentleyPolicyScenarios.userId, uid), eq(bentleyPolicyScenarios.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listRunsForScenario(params: {
  scenarioId: string;
  limit?: number;
}): Promise<PolicyScenarioRunRow[]> {
  const sid = String(params.scenarioId).trim();
  if (!sid) return [];
  const lim = Math.min(Math.max(params.limit ?? 20, 1), 100);
  try {
    const db = await getDb();
    return await db
      .select()
      .from(bentleyPolicyScenarioRuns)
      .where(eq(bentleyPolicyScenarioRuns.scenarioId, sid))
      .orderBy(desc(bentleyPolicyScenarioRuns.createdAt))
      .limit(lim);
  } catch {
    return [];
  }
}

export async function getLatestRunForScenario(scenarioId: string): Promise<PolicyScenarioRunRow | null> {
  const rows = await listRunsForScenario({ scenarioId, limit: 1 });
  return rows[0] ?? null;
}
