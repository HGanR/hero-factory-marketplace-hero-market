import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastTimelineTemplates } from "@/lib/db/schema";
import { broadcastAudit } from "./broadcast-audit";
import {
  incrementBroadcastTimelineTemplateCreate,
  incrementBroadcastTimelineTemplateDelete,
  incrementBroadcastTimelineTemplateUpdate,
} from "./broadcast-metrics";
import type { BroadcastTimelineTemplateBody } from "./broadcast-timeline-template";
import { validateBroadcastTimelineTemplate } from "./broadcast-timeline-template";

export type BroadcastTimelineTemplateRow = {
  id: number;
  userId: number;
  name: string;
  template: BroadcastTimelineTemplateBody;
  isDefault: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

function rowToDto(row: typeof meetBroadcastTimelineTemplates.$inferSelect): BroadcastTimelineTemplateRow | null {
  const v = validateBroadcastTimelineTemplate(row.templateJson);
  if (!v.ok) return null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    template: v.template,
    isDefault: Boolean(row.isDefault),
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

export async function listTimelineTemplatesForUser(userId: number): Promise<BroadcastTimelineTemplateRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastTimelineTemplates)
    .where(eq(meetBroadcastTimelineTemplates.userId, userId))
    .orderBy(desc(meetBroadcastTimelineTemplates.updatedAt));
  const out: BroadcastTimelineTemplateRow[] = [];
  for (const r of rows) {
    const d = rowToDto(r);
    if (d) out.push(d);
  }
  return out;
}

export async function listTimelineTemplatesByIdsForUser(
  userId: number,
  ids: number[]
): Promise<Map<number, BroadcastTimelineTemplateRow>> {
  const out = new Map<number, BroadcastTimelineTemplateRow>();
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastTimelineTemplates)
    .where(and(eq(meetBroadcastTimelineTemplates.userId, userId), inArray(meetBroadcastTimelineTemplates.id, unique)));
  for (const r of rows) {
    const d = rowToDto(r);
    if (d) out.set(d.id, d);
  }
  return out;
}

/** Admin-only aggregate dashboards. */
export async function listTimelineTemplatesByIdsInternal(ids: number[]): Promise<Map<number, BroadcastTimelineTemplateRow>> {
  const out = new Map<number, BroadcastTimelineTemplateRow>();
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastTimelineTemplates)
    .where(inArray(meetBroadcastTimelineTemplates.id, unique));
  for (const r of rows) {
    const d = rowToDto(r);
    if (d) out.set(d.id, d);
  }
  return out;
}

export async function getTimelineTemplateById(
  id: number,
  userId: number
): Promise<BroadcastTimelineTemplateRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastTimelineTemplates)
    .where(and(eq(meetBroadcastTimelineTemplates.id, id), eq(meetBroadcastTimelineTemplates.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToDto(row);
}

export async function getDefaultTimelineTemplate(userId: number): Promise<BroadcastTimelineTemplateRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastTimelineTemplates)
    .where(
      and(eq(meetBroadcastTimelineTemplates.userId, userId), eq(meetBroadcastTimelineTemplates.isDefault, true))
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToDto(row);
}

export async function createTimelineTemplate(params: {
  userId: number;
  name: string;
  templateJson: unknown;
}): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const v = validateBroadcastTimelineTemplate(params.templateJson);
  if (!v.ok) return { ok: false, errors: v.errors };
  const db = await getDb();
  const payload = v.template as unknown as Record<string, unknown>;
  const [ins] = await db
    .insert(meetBroadcastTimelineTemplates)
    .values({
      userId: params.userId,
      name: params.name.slice(0, 160),
      templateJson: payload,
      isDefault: false,
    })
    .$returningId();
  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) return { ok: false, errors: ["insert_failed"] };
  incrementBroadcastTimelineTemplateCreate({ userId: params.userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_timeline_template_created", { userId: params.userId, templateId: id });
  return { ok: true, id };
}

export async function updateTimelineTemplate(
  id: number,
  userId: number,
  patch: { name?: string; templateJson?: unknown; isDefault?: boolean }
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const existing = await getTimelineTemplateById(id, userId);
  if (!existing) return { ok: false, errors: ["not_found"] };

  let templateBody: BroadcastTimelineTemplateBody = existing.template;
  if (patch.templateJson !== undefined) {
    const v = validateBroadcastTimelineTemplate(patch.templateJson);
    if (!v.ok) return { ok: false, errors: v.errors };
    templateBody = v.template;
  }

  const db = await getDb();
  if (patch.isDefault === true) {
    await db
      .update(meetBroadcastTimelineTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(meetBroadcastTimelineTemplates.userId, userId));
  }

  const setObj: {
    name?: string;
    templateJson?: Record<string, unknown>;
    isDefault?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.name != null) setObj.name = patch.name.slice(0, 160);
  if (patch.templateJson !== undefined) setObj.templateJson = templateBody as unknown as Record<string, unknown>;
  if (patch.isDefault !== undefined) setObj.isDefault = patch.isDefault;

  await db
    .update(meetBroadcastTimelineTemplates)
    .set(setObj)
    .where(and(eq(meetBroadcastTimelineTemplates.id, id), eq(meetBroadcastTimelineTemplates.userId, userId)));

  incrementBroadcastTimelineTemplateUpdate({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_timeline_template_updated", { userId, templateId: id });
  return { ok: true };
}

export async function deleteTimelineTemplate(id: number, userId: number): Promise<boolean> {
  if (!(await getTimelineTemplateById(id, userId))) return false;
  const db = await getDb();
  await db
    .delete(meetBroadcastTimelineTemplates)
    .where(and(eq(meetBroadcastTimelineTemplates.id, id), eq(meetBroadcastTimelineTemplates.userId, userId)));
  incrementBroadcastTimelineTemplateDelete({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_timeline_template_deleted", { userId, templateId: id });
  return true;
}
