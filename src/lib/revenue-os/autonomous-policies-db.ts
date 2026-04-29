/**
 * DB access for bentley_autonomous_action_policies + bentley_autonomous_action_runs.
 */

import crypto from "crypto";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyAutonomousActionPolicies, bentleyAutonomousActionRuns } from "@/lib/db/schema";
import type { BentleyAutonomousActionType } from "@/lib/revenue-os/autonomous-types";

export type AutonomousPolicyRow = typeof bentleyAutonomousActionPolicies.$inferSelect;
export type AutonomousRunRow = typeof bentleyAutonomousActionRuns.$inferSelect;

export async function listAutonomousPoliciesForUser(params: {
  userId: string;
  clientId?: string;
  trustId?: string;
}): Promise<AutonomousPolicyRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const c = params.clientId?.trim() ?? "";
  const t = params.trustId?.trim() ?? "";
  try {
    const db = await getDb();
    const scopeOrGlobal =
      c !== "" || t !== ""
        ? or(
            and(eq(bentleyAutonomousActionPolicies.clientId, c), eq(bentleyAutonomousActionPolicies.trustId, t)),
            and(eq(bentleyAutonomousActionPolicies.clientId, ""), eq(bentleyAutonomousActionPolicies.trustId, ""))
          )
        : null;
    const rows = await db
      .select()
      .from(bentleyAutonomousActionPolicies)
      .where(
        scopeOrGlobal
          ? and(eq(bentleyAutonomousActionPolicies.userId, uid), scopeOrGlobal)
          : eq(bentleyAutonomousActionPolicies.userId, uid)
      )
      .orderBy(desc(bentleyAutonomousActionPolicies.updatedAt));
    return rows;
  } catch (e) {
    console.warn("[autonomous-policies-db] list failed", e);
    return [];
  }
}

export async function getAutonomousPolicyForUser(params: {
  userId: string;
  policyId: string;
}): Promise<AutonomousPolicyRow | null> {
  const uid = String(params.userId).trim();
  const id = String(params.policyId).trim();
  if (!uid || !id) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyAutonomousActionPolicies)
      .where(and(eq(bentleyAutonomousActionPolicies.userId, uid), eq(bentleyAutonomousActionPolicies.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertAutonomousPolicy(params: {
  userId: string;
  id?: string;
  clientId: string;
  trustId: string;
  actionType: BentleyAutonomousActionType;
  isEnabled: boolean;
  requiresApprovalAboveSeverity: string;
  maxDailyExecutions?: number | null;
  cooldownMinutes?: number | null;
  policyConfigJson?: Record<string, unknown> | null;
}): Promise<{ row: AutonomousPolicyRow | null; ok: boolean }> {
  const uid = String(params.userId).trim();
  if (!uid) return { row: null, ok: false };
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    const existing = await getAutonomousPolicyForUser({ userId: uid, policyId: id });
    if (existing) {
      await db
        .update(bentleyAutonomousActionPolicies)
        .set({
          clientId: params.clientId,
          trustId: params.trustId,
          actionType: params.actionType,
          isEnabled: params.isEnabled,
          requiresApprovalAboveSeverity: params.requiresApprovalAboveSeverity,
          maxDailyExecutions: params.maxDailyExecutions ?? null,
          cooldownMinutes: params.cooldownMinutes ?? null,
          policyConfigJson: params.policyConfigJson ?? null,
        })
        .where(and(eq(bentleyAutonomousActionPolicies.userId, uid), eq(bentleyAutonomousActionPolicies.id, id)));
    } else {
      await db.insert(bentleyAutonomousActionPolicies).values({
        id,
        userId: uid,
        clientId: params.clientId,
        trustId: params.trustId,
        actionType: params.actionType,
        isEnabled: params.isEnabled,
        requiresApprovalAboveSeverity: params.requiresApprovalAboveSeverity,
        maxDailyExecutions: params.maxDailyExecutions ?? null,
        cooldownMinutes: params.cooldownMinutes ?? null,
        policyConfigJson: params.policyConfigJson ?? null,
      });
    }
    const row = await getAutonomousPolicyForUser({ userId: uid, policyId: id });
    return { row, ok: true };
  } catch (e) {
    console.warn("[autonomous-policies-db] upsert failed", e);
    return { row: null, ok: false };
  }
}

export async function toggleAutonomousPolicy(params: {
  userId: string;
  policyId: string;
  isEnabled: boolean;
}): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    await db
      .update(bentleyAutonomousActionPolicies)
      .set({ isEnabled: params.isEnabled })
      .where(
        and(
          eq(bentleyAutonomousActionPolicies.userId, String(params.userId)),
          eq(bentleyAutonomousActionPolicies.id, params.policyId)
        )
      );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export async function countAutonomousRunsTodayForPolicy(policyId: string): Promise<number> {
  const pid = String(policyId).trim();
  if (!pid) return 0;
  try {
    const db = await getDb();
    const since = startOfUtcDay(new Date());
    const rows = await db
      .select({ c: sql<number>`count(*)` })
      .from(bentleyAutonomousActionRuns)
      .where(
        and(eq(bentleyAutonomousActionRuns.policyId, pid), gte(bentleyAutonomousActionRuns.startedAt, since))
      );
    return Number(rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

export async function countAutonomousRunsSinceForPolicy(policyId: string, sinceMs: number): Promise<number> {
  const pid = String(policyId).trim();
  if (!pid) return 0;
  try {
    const db = await getDb();
    const since = new Date(sinceMs);
    const rows = await db
      .select({ c: sql<number>`count(*)` })
      .from(bentleyAutonomousActionRuns)
      .where(
        and(eq(bentleyAutonomousActionRuns.policyId, pid), gte(bentleyAutonomousActionRuns.startedAt, since))
      );
    return Number(rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

export async function insertAutonomousActionRun(params: {
  policyId: string;
  actionType: string;
  runStatus: AutonomousRunRow["runStatus"];
  scopeJson?: Record<string, unknown> | null;
  decisionSummaryJson?: Record<string, unknown> | null;
  executedCount?: number;
  skippedCount?: number;
  completedAt?: Date | null;
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyAutonomousActionRuns).values({
      id,
      policyId: params.policyId,
      actionType: params.actionType,
      runStatus: params.runStatus,
      scopeJson: params.scopeJson ?? null,
      decisionSummaryJson: params.decisionSummaryJson ?? null,
      executedCount: params.executedCount ?? 0,
      skippedCount: params.skippedCount ?? 0,
      completedAt: params.completedAt ?? null,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[autonomous-policies-db] insert run failed", e);
    return { id, ok: false };
  }
}

export async function updateAutonomousActionRun(params: {
  runId: string;
  runStatus?: AutonomousRunRow["runStatus"];
  executedCount?: number;
  skippedCount?: number;
  decisionSummaryJson?: Record<string, unknown> | null;
  completedAt?: Date | null;
}): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    await db
      .update(bentleyAutonomousActionRuns)
      .set({
        ...(params.runStatus ? { runStatus: params.runStatus } : {}),
        ...(params.executedCount != null ? { executedCount: params.executedCount } : {}),
        ...(params.skippedCount != null ? { skippedCount: params.skippedCount } : {}),
        ...(params.decisionSummaryJson !== undefined ? { decisionSummaryJson: params.decisionSummaryJson } : {}),
        ...(params.completedAt !== undefined ? { completedAt: params.completedAt } : {}),
      })
      .where(eq(bentleyAutonomousActionRuns.id, params.runId));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getAutonomousRunByIdForUser(params: {
  userId: string;
  runId: string;
}): Promise<(AutonomousRunRow & { policy?: AutonomousPolicyRow }) | null> {
  const uid = String(params.userId).trim();
  const rid = String(params.runId).trim();
  if (!uid || !rid) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select({ run: bentleyAutonomousActionRuns, policy: bentleyAutonomousActionPolicies })
      .from(bentleyAutonomousActionRuns)
      .innerJoin(
        bentleyAutonomousActionPolicies,
        eq(bentleyAutonomousActionRuns.policyId, bentleyAutonomousActionPolicies.id)
      )
      .where(and(eq(bentleyAutonomousActionRuns.id, rid), eq(bentleyAutonomousActionPolicies.userId, uid)))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return { ...r.run, policy: r.policy };
  } catch {
    return null;
  }
}

export async function listAutonomousRunsForUser(params: {
  userId: string;
  limit?: number;
  clientId?: string;
  trustId?: string;
}): Promise<Array<AutonomousRunRow & { policyUserId?: string }>> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const limit = Math.min(200, Math.max(1, params.limit ?? 40));
  try {
    const db = await getDb();
    const rows = await db
      .select({
        run: bentleyAutonomousActionRuns,
        policyUserId: bentleyAutonomousActionPolicies.userId,
        pClient: bentleyAutonomousActionPolicies.clientId,
        pTrust: bentleyAutonomousActionPolicies.trustId,
      })
      .from(bentleyAutonomousActionRuns)
      .innerJoin(
        bentleyAutonomousActionPolicies,
        eq(bentleyAutonomousActionRuns.policyId, bentleyAutonomousActionPolicies.id)
      )
      .where(eq(bentleyAutonomousActionPolicies.userId, uid))
      .orderBy(desc(bentleyAutonomousActionRuns.startedAt))
      .limit(limit * 2);

    const c = params.clientId?.trim() ?? "";
    const t = params.trustId?.trim() ?? "";
    const filtered =
      c || t
        ? rows.filter((r) => {
            const gc = r.pClient ?? "";
            const gt = r.pTrust ?? "";
            if (gc === "" && gt === "") return true;
            return gc === c && gt === t;
          })
        : rows;

    return filtered.slice(0, limit).map((r) => ({ ...r.run, policyUserId: r.policyUserId }));
  } catch (e) {
    console.warn("[autonomous-policies-db] list runs failed", e);
    return [];
  }
}
