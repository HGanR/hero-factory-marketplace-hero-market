/**
 * DB access for bentley_automation_policies + bentley_automation_runs.
 */

import crypto from "crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyAutomationPolicies, bentleyAutomationRuns } from "@/lib/db/schema";
import type { AutomationPolicyType } from "@/lib/revenue-os/automation-policy-helpers";

export type AutomationPolicyRow = typeof bentleyAutomationPolicies.$inferSelect;
export type AutomationRunRow = typeof bentleyAutomationRuns.$inferSelect;

export async function listAutomationPoliciesForUser(params: {
  userId: string;
  clientId?: string;
  trustId?: string;
}): Promise<AutomationPolicyRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const c = params.clientId?.trim() ?? "";
  const t = params.trustId?.trim() ?? "";
  try {
    const db = await getDb();
    const scopeOrGlobal =
      c !== "" || t !== ""
        ? or(
            and(eq(bentleyAutomationPolicies.clientId, c), eq(bentleyAutomationPolicies.trustId, t)),
            and(eq(bentleyAutomationPolicies.clientId, ""), eq(bentleyAutomationPolicies.trustId, ""))
          )
        : null;
    const rows = await db
      .select()
      .from(bentleyAutomationPolicies)
      .where(scopeOrGlobal ? and(eq(bentleyAutomationPolicies.userId, uid), scopeOrGlobal) : eq(bentleyAutomationPolicies.userId, uid))
      .orderBy(desc(bentleyAutomationPolicies.updatedAt));
    return rows;
  } catch (e) {
    console.warn("[automation-policies-db] list failed", e);
    return [];
  }
}

export async function getAutomationPolicyForUser(params: {
  userId: string;
  policyId: string;
}): Promise<AutomationPolicyRow | null> {
  const uid = String(params.userId).trim();
  const id = String(params.policyId).trim();
  if (!uid || !id) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyAutomationPolicies)
      .where(and(eq(bentleyAutomationPolicies.userId, uid), eq(bentleyAutomationPolicies.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertAutomationPolicy(params: {
  userId: string;
  id?: string;
  clientId: string;
  trustId: string;
  policyType: AutomationPolicyType;
  isEnabled: boolean;
  scheduleJson?: Record<string, unknown> | null;
  policyConfigJson?: Record<string, unknown> | null;
  nextRunAt?: Date | null;
}): Promise<{ row: AutomationPolicyRow | null; ok: boolean; reason?: string }> {
  const uid = String(params.userId).trim();
  if (!uid) return { row: null, ok: false, reason: "no_user" };
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    const existing = await getAutomationPolicyForUser({ userId: uid, policyId: id });
    if (existing) {
      await db
        .update(bentleyAutomationPolicies)
        .set({
          clientId: params.clientId,
          trustId: params.trustId,
          policyType: params.policyType,
          isEnabled: params.isEnabled,
          scheduleJson: params.scheduleJson ?? null,
          policyConfigJson: params.policyConfigJson ?? null,
          ...(params.nextRunAt !== undefined ? { nextRunAt: params.nextRunAt } : {}),
        })
        .where(and(eq(bentleyAutomationPolicies.userId, uid), eq(bentleyAutomationPolicies.id, id)));
    } else {
      await db.insert(bentleyAutomationPolicies).values({
        id,
        userId: uid,
        clientId: params.clientId,
        trustId: params.trustId,
        policyType: params.policyType,
        isEnabled: params.isEnabled,
        scheduleJson: params.scheduleJson ?? null,
        policyConfigJson: params.policyConfigJson ?? null,
        nextRunAt: params.nextRunAt ?? new Date(),
      });
    }
    const row = await getAutomationPolicyForUser({ userId: uid, policyId: id });
    return { row, ok: true };
  } catch (e) {
    console.warn("[automation-policies-db] upsert failed", e);
    return { row: null, ok: false, reason: "db_error" };
  }
}

export async function toggleAutomationPolicy(params: {
  userId: string;
  policyId: string;
  isEnabled: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  const row = await getAutomationPolicyForUser({ userId: params.userId, policyId: params.policyId });
  if (!row) return { ok: false, reason: "not_found" };
  try {
    const db = await getDb();
    await db
      .update(bentleyAutomationPolicies)
      .set({ isEnabled: params.isEnabled })
      .where(
        and(eq(bentleyAutomationPolicies.userId, String(params.userId)), eq(bentleyAutomationPolicies.id, params.policyId))
      );
    return { ok: true };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}

export async function updatePolicyRunSchedule(params: {
  userId: string;
  policyId: string;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    await db
      .update(bentleyAutomationPolicies)
      .set({
        lastRunAt: params.lastRunAt,
        nextRunAt: params.nextRunAt,
      })
      .where(
        and(eq(bentleyAutomationPolicies.userId, params.userId), eq(bentleyAutomationPolicies.id, params.policyId))
      );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function insertAutomationRun(params: {
  policyId: string;
  runStatus: "started" | "completed" | "partial" | "failed" | "skipped";
  runSummaryJson?: Record<string, unknown> | null;
  startedAt?: Date;
  completedAt?: Date | null;
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyAutomationRuns).values({
      id,
      policyId: params.policyId,
      runStatus: params.runStatus,
      runSummaryJson: params.runSummaryJson ?? null,
      startedAt: params.startedAt ?? new Date(),
      completedAt: params.completedAt ?? null,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[automation-policies-db] insert run failed", e);
    return { id, ok: false };
  }
}

export async function completeAutomationRun(params: {
  runId: string;
  runStatus: "completed" | "partial" | "failed" | "skipped";
  runSummaryJson?: Record<string, unknown> | null;
}): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    await db
      .update(bentleyAutomationRuns)
      .set({
        runStatus: params.runStatus,
        runSummaryJson: params.runSummaryJson ?? null,
        completedAt: new Date(),
      })
      .where(eq(bentleyAutomationRuns.id, params.runId));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function listAutomationRunsForUser(params: {
  userId: string;
  policyId?: string;
  limit?: number;
}): Promise<AutomationRunRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  try {
    const db = await getDb();
    if (params.policyId) {
      const own = await getAutomationPolicyForUser({ userId: uid, policyId: params.policyId });
      if (!own) return [];
      return await db
        .select()
        .from(bentleyAutomationRuns)
        .where(eq(bentleyAutomationRuns.policyId, params.policyId))
        .orderBy(desc(bentleyAutomationRuns.startedAt))
        .limit(limit);
    }
    const policyRows = await db
      .select({ id: bentleyAutomationPolicies.id })
      .from(bentleyAutomationPolicies)
      .where(eq(bentleyAutomationPolicies.userId, uid));
    const policyIds = policyRows.map((r) => r.id);
    if (!policyIds.length) return [];
    return await db
      .select()
      .from(bentleyAutomationRuns)
      .where(inArray(bentleyAutomationRuns.policyId, policyIds))
      .orderBy(desc(bentleyAutomationRuns.startedAt))
      .limit(limit);
  } catch (e) {
    console.warn("[automation-policies-db] list runs failed", e);
    return [];
  }
}
