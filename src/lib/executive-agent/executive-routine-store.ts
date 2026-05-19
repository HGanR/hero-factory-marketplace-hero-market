import "server-only";

import { randomUUID } from "crypto";
import { and, asc, eq, lte } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentRoutines, EXECUTIVE_ROUTINE_TYPES } from "@/lib/db/schema";
import {
  computeNextExecutiveRoutineRunAt,
  type ExecutiveRoutineCadence,
} from "@/lib/executive-agent/executive-routine-schedule";

type Db = MySql2Database<typeof schema>;

export type ExecutiveRoutineType = (typeof EXECUTIVE_ROUTINE_TYPES)[number];
export { computeNextExecutiveRoutineRunAt, type ExecutiveRoutineCadence } from "@/lib/executive-agent/executive-routine-schedule";

export async function listExecutiveRoutinesForAdmin(db: Db, adminUserId: number) {
  return db
    .select()
    .from(executiveAgentRoutines)
    .where(eq(executiveAgentRoutines.adminUserId, adminUserId))
    .orderBy(asc(executiveAgentRoutines.routineType));
}

export async function getExecutiveRoutineForAdmin(db: Db, id: string, adminUserId: number) {
  const [row] = await db
    .select()
    .from(executiveAgentRoutines)
    .where(and(eq(executiveAgentRoutines.id, id), eq(executiveAgentRoutines.adminUserId, adminUserId)))
    .limit(1);
  return row ?? null;
}

export async function findExecutiveRoutineByType(db: Db, adminUserId: number, routineType: ExecutiveRoutineType) {
  const [row] = await db
    .select()
    .from(executiveAgentRoutines)
    .where(and(eq(executiveAgentRoutines.adminUserId, adminUserId), eq(executiveAgentRoutines.routineType, routineType)))
    .limit(1);
  return row ?? null;
}

export async function createExecutiveRoutine(
  db: Db,
  input: {
    adminUserId: number;
    routineType: ExecutiveRoutineType;
    cadence: ExecutiveRoutineCadence;
    enabled: boolean;
    configJson: string;
    nextRunAt: Date;
  }
): Promise<
  | { ok: true; row: typeof executiveAgentRoutines.$inferSelect }
  | { ok: false; duplicate: true; row: typeof executiveAgentRoutines.$inferSelect }
> {
  const dup = await findExecutiveRoutineByType(db, input.adminUserId, input.routineType);
  if (dup) return { ok: false, duplicate: true, row: dup };
  const id = randomUUID();
  await db.insert(executiveAgentRoutines).values({
    id,
    adminUserId: input.adminUserId,
    routineType: input.routineType,
    cadence: input.cadence,
    enabled: input.enabled,
    configJson: input.configJson.slice(0, 100_000),
    nextRunAt: input.nextRunAt,
    lastRunAt: null,
    lastOutputJson: null,
  });
  const row = await getExecutiveRoutineForAdmin(db, id, input.adminUserId);
  if (!row) throw new Error("ROUTINE_INSERT_FAILED");
  return { ok: true, row };
}

export async function updateExecutiveRoutineForAdmin(
  db: Db,
  id: string,
  adminUserId: number,
  patch: {
    enabled?: boolean;
    cadence?: ExecutiveRoutineCadence;
    configJson?: string;
    nextRunAt?: Date;
  }
) {
  const existing = await getExecutiveRoutineForAdmin(db, id, adminUserId);
  if (!existing) return null;
  const nextCadence = patch.cadence ?? (existing.cadence as ExecutiveRoutineCadence);
  const updates: Partial<typeof executiveAgentRoutines.$inferInsert> = {};
  if (patch.enabled !== undefined) updates.enabled = patch.enabled;
  if (patch.cadence !== undefined) updates.cadence = patch.cadence;
  if (patch.configJson !== undefined) updates.configJson = patch.configJson.slice(0, 100_000);
  if (patch.nextRunAt !== undefined) updates.nextRunAt = patch.nextRunAt;
  else if (patch.cadence !== undefined) {
    updates.nextRunAt = computeNextExecutiveRoutineRunAt(nextCadence, new Date());
  }
  if (Object.keys(updates).length === 0) return existing;
  await db
    .update(executiveAgentRoutines)
    .set(updates)
    .where(and(eq(executiveAgentRoutines.id, id), eq(executiveAgentRoutines.adminUserId, adminUserId)));
  return getExecutiveRoutineForAdmin(db, id, adminUserId);
}

export async function listDueExecutiveRoutinesForCron(db: Db, before: Date) {
  return db
    .select()
    .from(executiveAgentRoutines)
    .where(
      and(eq(executiveAgentRoutines.enabled, true), lte(executiveAgentRoutines.nextRunAt, before)),
    );
}

export async function persistExecutiveRoutineRunResult(
  db: Db,
  id: string,
  input: { lastRunAt: Date; nextRunAt: Date; lastOutputJson: string }
) {
  await db
    .update(executiveAgentRoutines)
    .set({
      lastRunAt: input.lastRunAt,
      nextRunAt: input.nextRunAt,
      lastOutputJson: input.lastOutputJson.slice(0, 100_000),
    })
    .where(eq(executiveAgentRoutines.id, id));
}
