import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, like, lt, or, type SQL } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  executiveAgentBriefings,
  executiveAgentMemoryItems,
  EXECUTIVE_MEMORY_SOURCES,
  EXECUTIVE_MEMORY_TYPES,
} from "@/lib/db/schema";

export { isExecutiveMemoryItemActive } from "@/lib/executive-agent/executive-memory-active";

type Db = MySql2Database<typeof schema>;

export type ExecutiveMemoryType = (typeof EXECUTIVE_MEMORY_TYPES)[number];
export type ExecutiveMemorySource = (typeof EXECUTIVE_MEMORY_SOURCES)[number];

export type CreateExecutiveMemoryInput = {
  memoryType: ExecutiveMemoryType;
  subjectType?: string | null;
  subjectId?: string | null;
  title: string;
  summary: string;
  source: ExecutiveMemorySource;
  confidence?: number;
  expiresAt?: Date | null;
};

export async function createExecutiveMemoryItem(db: Db, adminUserId: number, input: CreateExecutiveMemoryInput) {
  const id = randomUUID();
  const conf = input.confidence ?? 0.8;
  await db.insert(executiveAgentMemoryItems).values({
    id,
    adminUserId,
    memoryType: input.memoryType,
    subjectType: input.subjectType?.trim() || null,
    subjectId: input.subjectId?.trim() || null,
    title: input.title.trim().slice(0, 500),
    summary: input.summary.trim(),
    source: input.source,
    confidence: conf.toFixed(4),
    expiresAt: input.expiresAt ?? null,
    archivedAt: null,
  });
  const [row] = await db.select().from(executiveAgentMemoryItems).where(eq(executiveAgentMemoryItems.id, id)).limit(1);
  return row ?? null;
}

export type ListExecutiveMemoryOpts = {
  adminUserId: number;
  memoryTypes?: ExecutiveMemoryType[];
  searchTerm?: string;
  limit?: number;
  /** When true, include archived rows (default false). */
  includeArchived?: boolean;
  /** When false, include expired rows (default true = only active). */
  activeOnly?: boolean;
  now?: Date;
};

export async function listExecutiveMemoryItems(db: Db, opts: ListExecutiveMemoryOpts) {
  const limit = Math.min(Math.max(opts.limit ?? 80, 1), 200);
  const now = opts.now ?? new Date();
  const filters: SQL[] = [eq(executiveAgentMemoryItems.adminUserId, opts.adminUserId)];
  if (!opts.includeArchived) {
    filters.push(isNull(executiveAgentMemoryItems.archivedAt));
  }
  if (opts.activeOnly !== false) {
    filters.push(or(isNull(executiveAgentMemoryItems.expiresAt), gte(executiveAgentMemoryItems.expiresAt, now))!);
  }
  if (opts.memoryTypes?.length) {
    filters.push(inArray(executiveAgentMemoryItems.memoryType, opts.memoryTypes));
  }
  const term = (opts.searchTerm ?? "").trim().replace(/[%_\\]/g, "");
  if (term) {
    const pattern = `%${term}%`;
    filters.push(or(like(executiveAgentMemoryItems.title, pattern), like(executiveAgentMemoryItems.summary, pattern))!);
  }
  return db
    .select()
    .from(executiveAgentMemoryItems)
    .where(and(...filters))
    .orderBy(desc(executiveAgentMemoryItems.updatedAt))
    .limit(limit);
}

export async function searchExecutiveMemoryItems(db: Db, opts: ListExecutiveMemoryOpts & { searchTerm: string }) {
  return listExecutiveMemoryItems(db, { ...opts, searchTerm: opts.searchTerm });
}

export async function archiveExpiredExecutiveMemoryItems(db: Db, opts?: { adminUserId?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  const filters = [
    isNull(executiveAgentMemoryItems.archivedAt),
    isNotNull(executiveAgentMemoryItems.expiresAt),
    lt(executiveAgentMemoryItems.expiresAt, now),
  ];
  if (opts?.adminUserId != null) {
    filters.push(eq(executiveAgentMemoryItems.adminUserId, opts.adminUserId));
  }
  const res = await db
    .update(executiveAgentMemoryItems)
    .set({ archivedAt: now })
    .where(and(...filters));
  return res;
}

export async function upsertDecisionMemory(
  db: Db,
  adminUserId: number,
  input: {
    subjectType?: string | null;
    subjectId?: string | null;
    title: string;
    summary: string;
    source: ExecutiveMemorySource;
    confidence?: number;
  }
) {
  const st = input.subjectType?.trim() || null;
  const sid = input.subjectId?.trim() || null;
  const subjectFilters: SQL[] = [
    eq(executiveAgentMemoryItems.adminUserId, adminUserId),
    eq(executiveAgentMemoryItems.memoryType, "decision"),
    isNull(executiveAgentMemoryItems.archivedAt),
  ];
  subjectFilters.push(st == null ? isNull(executiveAgentMemoryItems.subjectType) : eq(executiveAgentMemoryItems.subjectType, st));
  subjectFilters.push(sid == null ? isNull(executiveAgentMemoryItems.subjectId) : eq(executiveAgentMemoryItems.subjectId, sid));

  const [existing] = await db
    .select()
    .from(executiveAgentMemoryItems)
    .where(and(...subjectFilters))
    .orderBy(desc(executiveAgentMemoryItems.updatedAt))
    .limit(1);

  const conf = (input.confidence ?? 0.85).toFixed(4);
  if (existing) {
    await db
      .update(executiveAgentMemoryItems)
      .set({
        title: input.title.trim().slice(0, 500),
        summary: input.summary.trim(),
        source: input.source,
        confidence: conf,
      })
      .where(eq(executiveAgentMemoryItems.id, existing.id));
    const [row] = await db.select().from(executiveAgentMemoryItems).where(eq(executiveAgentMemoryItems.id, existing.id)).limit(1);
    return row ?? null;
  }
  return createExecutiveMemoryItem(db, adminUserId, {
    memoryType: "decision",
    subjectType: st,
    subjectId: sid,
    title: input.title,
    summary: input.summary,
    source: input.source,
    confidence: Number(conf),
  });
}

export async function deleteExecutiveMemoryItemForAdmin(db: Db, id: string, adminUserId: number): Promise<boolean> {
  const [hit] = await db
    .select({ id: executiveAgentMemoryItems.id })
    .from(executiveAgentMemoryItems)
    .where(and(eq(executiveAgentMemoryItems.id, id), eq(executiveAgentMemoryItems.adminUserId, adminUserId)))
    .limit(1);
  if (!hit) return false;
  await db
    .delete(executiveAgentMemoryItems)
    .where(and(eq(executiveAgentMemoryItems.id, id), eq(executiveAgentMemoryItems.adminUserId, adminUserId)));
  return true;
}

export async function getExecutiveBriefingForAdminDate(db: Db, adminUserId: number, briefingDate: string) {
  const [row] = await db
    .select()
    .from(executiveAgentBriefings)
    .where(and(eq(executiveAgentBriefings.adminUserId, adminUserId), eq(executiveAgentBriefings.briefingDate, briefingDate)))
    .limit(1);
  return row ?? null;
}

export async function upsertExecutiveBriefingForAdminDate(
  db: Db,
  adminUserId: number,
  briefingDate: string,
  summaryJson: string
) {
  const existing = await getExecutiveBriefingForAdminDate(db, adminUserId, briefingDate);
  const id = existing?.id ?? randomUUID();
  if (existing) {
    await db
      .update(executiveAgentBriefings)
      .set({ summaryJson: summaryJson.slice(0, 500_000) })
      .where(eq(executiveAgentBriefings.id, existing.id));
    const [row] = await db.select().from(executiveAgentBriefings).where(eq(executiveAgentBriefings.id, existing.id)).limit(1);
    return row ?? null;
  }
  await db.insert(executiveAgentBriefings).values({
    id,
    adminUserId,
    briefingDate,
    summaryJson: summaryJson.slice(0, 500_000),
  });
  const [row] = await db.select().from(executiveAgentBriefings).where(eq(executiveAgentBriefings.id, id)).limit(1);
  return row ?? null;
}
