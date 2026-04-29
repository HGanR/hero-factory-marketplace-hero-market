/**
 * Persistence for Bentley coordinated policy change sets, items, and deployment runs.
 */

import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bentleyPolicyChangeSetItems,
  bentleyPolicyChangeSetRuns,
  bentleyPolicyChangeSets,
} from "@/lib/db/schema";

export type PolicyChangeSetRow = typeof bentleyPolicyChangeSets.$inferSelect;
export type PolicyChangeSetItemRow = typeof bentleyPolicyChangeSetItems.$inferSelect;
export type PolicyChangeSetRunRow = typeof bentleyPolicyChangeSetRuns.$inferSelect;

export type ChangeSetStatus = PolicyChangeSetRow["status"];
export type ChangeSetRunStatus = PolicyChangeSetRunRow["runStatus"];
export type ChangeSetItemStatus = PolicyChangeSetItemRow["itemStatus"];

export async function insertPolicyChangeSet(params: {
  userId: string;
  name: string;
  description?: string | null;
  changeSetType: string;
  scopeJson?: Record<string, unknown> | null;
  status?: string;
  sourceScenarioId?: string | null;
  sourceRolloutPlanId?: string | null;
  sourceRollbackPackageId?: string | null;
  id?: string;
}): Promise<PolicyChangeSetRow | null> {
  const uid = String(params.userId).trim();
  if (!uid) return null;
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyPolicyChangeSets).values({
      id,
      userId: uid,
      name: params.name.slice(0, 255),
      description: params.description?.trim() || null,
      changeSetType: params.changeSetType,
      scopeJson: params.scopeJson ?? null,
      status: params.status ?? "draft",
      sourceScenarioId: params.sourceScenarioId?.trim() || null,
      sourceRolloutPlanId: params.sourceRolloutPlanId?.trim() || null,
      sourceRollbackPackageId: params.sourceRollbackPackageId?.trim() || null,
    });
    const rows = await db.select().from(bentleyPolicyChangeSets).where(eq(bentleyPolicyChangeSets.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.warn("[policy-change-sets-db] insert change set failed", e);
    return null;
  }
}

export async function updatePolicyChangeSet(params: {
  changeSetId: string;
  name?: string;
  description?: string | null;
  status?: string;
  scopeJson?: Record<string, unknown> | null;
  changeSetType?: string;
  sourceScenarioId?: string | null;
  sourceRolloutPlanId?: string | null;
  sourceRollbackPackageId?: string | null;
}): Promise<boolean> {
  const id = String(params.changeSetId).trim();
  if (!id) return false;
  try {
    const db = await getDb();
    await db
      .update(bentleyPolicyChangeSets)
      .set({
        ...(params.name !== undefined ? { name: params.name.slice(0, 255) } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.scopeJson !== undefined ? { scopeJson: params.scopeJson } : {}),
        ...(params.changeSetType !== undefined ? { changeSetType: params.changeSetType } : {}),
        ...(params.sourceScenarioId !== undefined ? { sourceScenarioId: params.sourceScenarioId } : {}),
        ...(params.sourceRolloutPlanId !== undefined ? { sourceRolloutPlanId: params.sourceRolloutPlanId } : {}),
        ...(params.sourceRollbackPackageId !== undefined ? { sourceRollbackPackageId: params.sourceRollbackPackageId } : {}),
      })
      .where(eq(bentleyPolicyChangeSets.id, id));
    return true;
  } catch (e) {
    console.warn("[policy-change-sets-db] update change set failed", e);
    return false;
  }
}

export async function getPolicyChangeSetByIdForUser(params: {
  userId: string;
  changeSetId: string;
}): Promise<PolicyChangeSetRow | null> {
  const uid = String(params.userId).trim();
  const id = String(params.changeSetId).trim();
  if (!uid || !id) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyPolicyChangeSets)
      .where(and(eq(bentleyPolicyChangeSets.userId, uid), eq(bentleyPolicyChangeSets.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listPolicyChangeSetsForUser(params: {
  userId: string;
  limit?: number;
}): Promise<PolicyChangeSetRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const lim = Math.min(Math.max(params.limit ?? 50, 1), 200);
  try {
    const db = await getDb();
    return await db
      .select()
      .from(bentleyPolicyChangeSets)
      .where(eq(bentleyPolicyChangeSets.userId, uid))
      .orderBy(desc(bentleyPolicyChangeSets.updatedAt))
      .limit(lim);
  } catch (e) {
    console.warn("[policy-change-sets-db] list failed", e);
    return [];
  }
}

/** Latest change set the operator is likely editing or tracking (draft/ready/active). */
export async function getCurrentPolicyChangeSetForUser(params: { userId: string }): Promise<PolicyChangeSetRow | null> {
  const uid = String(params.userId).trim();
  if (!uid) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyPolicyChangeSets)
      .where(eq(bentleyPolicyChangeSets.userId, uid))
      .orderBy(desc(bentleyPolicyChangeSets.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listChangeSetItems(params: { changeSetId: string }): Promise<PolicyChangeSetItemRow[]> {
  const cid = String(params.changeSetId).trim();
  if (!cid) return [];
  try {
    const db = await getDb();
    return await db
      .select()
      .from(bentleyPolicyChangeSetItems)
      .where(eq(bentleyPolicyChangeSetItems.changeSetId, cid))
      .orderBy(bentleyPolicyChangeSetItems.itemOrder);
  } catch (e) {
    console.warn("[policy-change-sets-db] list items failed", e);
    return [];
  }
}

export async function getChangeSetItemByIdForUser(params: {
  userId: string;
  itemId: string;
}): Promise<{ item: PolicyChangeSetItemRow; changeSet: PolicyChangeSetRow } | null> {
  const uid = String(params.userId).trim();
  const iid = String(params.itemId).trim();
  if (!uid || !iid) return null;
  try {
    const db = await getDb();
    const itRows = await db
      .select()
      .from(bentleyPolicyChangeSetItems)
      .where(eq(bentleyPolicyChangeSetItems.id, iid))
      .limit(1);
    const item = itRows[0];
    if (!item) return null;
    const csRows = await db
      .select()
      .from(bentleyPolicyChangeSets)
      .where(and(eq(bentleyPolicyChangeSets.id, item.changeSetId), eq(bentleyPolicyChangeSets.userId, uid)))
      .limit(1);
    const changeSet = csRows[0];
    if (!changeSet) return null;
    return { item, changeSet };
  } catch {
    return null;
  }
}

export async function deleteItemsForChangeSet(changeSetId: string): Promise<boolean> {
  const id = String(changeSetId).trim();
  if (!id) return false;
  try {
    const db = await getDb();
    await db.delete(bentleyPolicyChangeSetItems).where(eq(bentleyPolicyChangeSetItems.changeSetId, id));
    return true;
  } catch (e) {
    console.warn("[policy-change-sets-db] delete items failed", e);
    return false;
  }
}

export async function insertChangeSetItems(
  rows: Array<{
    id?: string;
    changeSetId: string;
    policyFamily: string;
    itemOrder: number;
    itemStatus?: string;
    targetScopeJson?: Record<string, unknown> | null;
    payloadJson?: Record<string, unknown> | null;
    resultJson?: Record<string, unknown> | null;
  }>
): Promise<boolean> {
  if (!rows.length) return true;
  try {
    const db = await getDb();
    await db.insert(bentleyPolicyChangeSetItems).values(
      rows.map((r) => ({
        id: r.id?.trim() || crypto.randomUUID(),
        changeSetId: r.changeSetId,
        policyFamily: r.policyFamily,
        itemOrder: r.itemOrder,
        itemStatus: r.itemStatus ?? "pending",
        targetScopeJson: r.targetScopeJson ?? null,
        payloadJson: r.payloadJson ?? null,
        resultJson: r.resultJson ?? null,
      }))
    );
    return true;
  } catch (e) {
    console.warn("[policy-change-sets-db] insert items failed", e);
    return false;
  }
}

export async function replaceChangeSetItems(params: {
  changeSetId: string;
  items: Array<{
    policyFamily: string;
    itemOrder: number;
    itemStatus?: string;
    targetScopeJson?: Record<string, unknown> | null;
    payloadJson?: Record<string, unknown> | null;
    resultJson?: Record<string, unknown> | null;
  }>;
}): Promise<boolean> {
  const ok = await deleteItemsForChangeSet(params.changeSetId);
  if (!ok) return false;
  return insertChangeSetItems(
    params.items.map((it, idx) => ({
      changeSetId: params.changeSetId,
      policyFamily: it.policyFamily,
      itemOrder: it.itemOrder ?? idx,
      itemStatus: it.itemStatus,
      targetScopeJson: it.targetScopeJson,
      payloadJson: it.payloadJson,
      resultJson: it.resultJson,
    }))
  );
}

export async function updateChangeSetItem(params: {
  itemId: string;
  itemStatus?: string;
  resultJson?: Record<string, unknown> | null;
  payloadJson?: Record<string, unknown> | null;
}): Promise<boolean> {
  const id = String(params.itemId).trim();
  if (!id) return false;
  try {
    const db = await getDb();
    await db
      .update(bentleyPolicyChangeSetItems)
      .set({
        ...(params.itemStatus !== undefined ? { itemStatus: params.itemStatus } : {}),
        ...(params.resultJson !== undefined ? { resultJson: params.resultJson } : {}),
        ...(params.payloadJson !== undefined ? { payloadJson: params.payloadJson } : {}),
      })
      .where(eq(bentleyPolicyChangeSetItems.id, id));
    return true;
  } catch (e) {
    console.warn("[policy-change-sets-db] update item failed", e);
    return false;
  }
}

export async function insertChangeSetRun(params: {
  changeSetId: string;
  runStatus: string;
  runSummaryJson?: Record<string, unknown> | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  id?: string;
}): Promise<PolicyChangeSetRunRow | null> {
  const cid = String(params.changeSetId).trim();
  if (!cid) return null;
  const id = params.id?.trim() || crypto.randomUUID();
  const started = params.startedAt ?? new Date();
  try {
    const db = await getDb();
    await db.insert(bentleyPolicyChangeSetRuns).values({
      id,
      changeSetId: cid,
      runStatus: params.runStatus,
      runSummaryJson: params.runSummaryJson ?? null,
      startedAt: started,
      completedAt: params.completedAt ?? null,
    });
    const rows = await db.select().from(bentleyPolicyChangeSetRuns).where(eq(bentleyPolicyChangeSetRuns.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.warn("[policy-change-sets-db] insert run failed", e);
    return null;
  }
}

export async function updateChangeSetRun(params: {
  runId: string;
  runStatus?: string;
  runSummaryJson?: Record<string, unknown> | null;
  completedAt?: Date | null;
}): Promise<boolean> {
  const id = String(params.runId).trim();
  if (!id) return false;
  try {
    const db = await getDb();
    await db
      .update(bentleyPolicyChangeSetRuns)
      .set({
        ...(params.runStatus !== undefined ? { runStatus: params.runStatus } : {}),
        ...(params.runSummaryJson !== undefined ? { runSummaryJson: params.runSummaryJson } : {}),
        ...(params.completedAt !== undefined ? { completedAt: params.completedAt } : {}),
      })
      .where(eq(bentleyPolicyChangeSetRuns.id, id));
    return true;
  } catch (e) {
    console.warn("[policy-change-sets-db] update run failed", e);
    return false;
  }
}

export async function listChangeSetRuns(params: { changeSetId: string; limit?: number }): Promise<PolicyChangeSetRunRow[]> {
  const cid = String(params.changeSetId).trim();
  if (!cid) return [];
  const lim = Math.min(Math.max(params.limit ?? 20, 1), 100);
  try {
    const db = await getDb();
    return await db
      .select()
      .from(bentleyPolicyChangeSetRuns)
      .where(eq(bentleyPolicyChangeSetRuns.changeSetId, cid))
      .orderBy(desc(bentleyPolicyChangeSetRuns.createdAt))
      .limit(lim);
  } catch (e) {
    console.warn("[policy-change-sets-db] list runs failed", e);
    return [];
  }
}

export async function getChangeSetRunById(params: { runId: string }): Promise<PolicyChangeSetRunRow | null> {
  const id = String(params.runId).trim();
  if (!id) return null;
  try {
    const db = await getDb();
    const rows = await db.select().from(bentleyPolicyChangeSetRuns).where(eq(bentleyPolicyChangeSetRuns.id, id)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
