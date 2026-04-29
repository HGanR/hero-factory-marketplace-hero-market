import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastEvents, meetBroadcastSessions } from "@/lib/db/schema";
import { broadcastAudit } from "./broadcast-audit";
import type { BroadcastEvent, BroadcastEventInput } from "./broadcast-events";
import { validateBroadcastEvent } from "./broadcast-events";
import {
  incrementBroadcastEventCreate,
  incrementBroadcastEventDelete,
  incrementBroadcastEventPrepareLaunch,
  incrementBroadcastEventUpdate,
} from "./broadcast-metrics";
import { resolveBroadcastStartScene } from "./broadcast-start-scene";
import { shiftTemplateTimesRelativeToEventStart } from "./broadcast-timeline-template";
import { getTimelineTemplateById } from "./broadcast-timeline-templates";
import { toBroadcastCalendarLinkSummary, type BroadcastCalendarLinkSummary } from "./broadcast-calendar-sync";
import { getBroadcastCalendarLinkByBroadcastEventId } from "./broadcast-calendar-link-store";
import {
  buildLaunchDefaultsFromShowPackage,
  resolveEffectiveLaunchFields,
  summarizeBroadcastShowPackage,
  type BroadcastShowPackageSummary,
  type GuestCardPackSummaryPayload,
  type OverlayPackSummaryPayload,
} from "./broadcast-show-packages";
import { getDefaultShowPackageForUser, getBroadcastShowPackageById } from "./broadcast-show-package-store";
import { getBroadcastOverlayPackById } from "./broadcast-overlay-pack-store";
import { summarizeBroadcastOverlayPack } from "./broadcast-overlay-packs";
import { getBroadcastGuestCardPackById } from "./broadcast-guest-card-pack-store";

function rowToEvent(row: typeof meetBroadcastEvents.$inferSelect): BroadcastEvent {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description ?? null,
    scheduledStartIso: row.scheduledStartAt.toISOString(),
    scheduledEndIso: row.scheduledEndAt ? row.scheduledEndAt.toISOString() : null,
    timezone: row.timezone ?? null,
    roomId: row.roomId ?? null,
    status: row.status as BroadcastEvent["status"],
    scenePresetId: row.scenePresetId ?? null,
    defaultTimelineTemplateId: row.defaultTimelineTemplateId ?? null,
    showPackageId: row.showPackageId ?? null,
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

export async function getBroadcastEventById(id: number, userId: number): Promise<BroadcastEvent | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastEvents)
    .where(and(eq(meetBroadcastEvents.id, id), eq(meetBroadcastEvents.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToEvent(row);
}

/** Batch-load broadcast events for the user (e.g. analytics dashboard). */
export async function listBroadcastEventsByIdsForUser(userId: number, ids: number[]): Promise<Map<number, BroadcastEvent>> {
  const out = new Map<number, BroadcastEvent>();
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastEvents)
    .where(and(eq(meetBroadcastEvents.userId, userId), inArray(meetBroadcastEvents.id, unique)));
  for (const row of rows) {
    out.set(row.id, rowToEvent(row));
  }
  return out;
}

/** Admin-only aggregate dashboards (sessions may span users). */
export async function listBroadcastEventsByIdsInternal(ids: number[]): Promise<Map<number, BroadcastEvent>> {
  const out = new Map<number, BroadcastEvent>();
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (unique.length === 0) return out;
  const db = await getDb();
  const rows = await db.select().from(meetBroadcastEvents).where(inArray(meetBroadcastEvents.id, unique));
  for (const row of rows) {
    out.set(row.id, rowToEvent(row));
  }
  return out;
}

export async function listUpcomingBroadcastEvents(userId: number, limit = 50): Promise<BroadcastEvent[]> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(meetBroadcastEvents)
    .where(
      and(
        eq(meetBroadcastEvents.userId, userId),
        gte(meetBroadcastEvents.scheduledStartAt, now),
        ne(meetBroadcastEvents.status, "cancelled"),
        ne(meetBroadcastEvents.status, "completed")
      )
    )
    .orderBy(asc(meetBroadcastEvents.scheduledStartAt))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows.map(rowToEvent);
}

export async function listBroadcastEventsForUser(userId: number, limit = 50): Promise<BroadcastEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastEvents)
    .where(eq(meetBroadcastEvents.userId, userId))
    .orderBy(desc(meetBroadcastEvents.scheduledStartAt))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows.map(rowToEvent);
}

export async function createBroadcastEvent(
  userId: number,
  input: BroadcastEventInput
): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const v = validateBroadcastEvent(input, "create");
  if (!v.ok) return { ok: false, errors: v.errors };
  const d = v.data;
  if (!d.title || !d.scheduledStartIso) return { ok: false, errors: ["title and scheduledStartIso required"] };

  const db = await getDb();
  const [ins] = await db
    .insert(meetBroadcastEvents)
    .values({
      userId,
      title: d.title,
      description: d.description ?? null,
      scheduledStartAt: new Date(d.scheduledStartIso),
      scheduledEndAt: d.scheduledEndIso ? new Date(d.scheduledEndIso) : null,
      timezone: d.timezone ?? null,
      roomId: d.roomId ?? null,
      status: (d.status ?? "draft") as string,
      scenePresetId: d.scenePresetId ?? null,
      defaultTimelineTemplateId: d.defaultTimelineTemplateId ?? null,
      showPackageId: d.showPackageId ?? null,
    })
    .$returningId();

  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) return { ok: false, errors: ["insert_failed"] };
  incrementBroadcastEventCreate({ userId, sessionId: null, roomId: d.roomId ?? null });
  broadcastAudit("broadcast_event_created", { userId, eventId: id, title: d.title.slice(0, 120) });
  return { ok: true, id };
}

export async function updateBroadcastEvent(
  id: number,
  userId: number,
  input: BroadcastEventInput
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const existing = await getBroadcastEventById(id, userId);
  if (!existing) return { ok: false, errors: ["not_found"] };
  const v = validateBroadcastEvent(input, "patch");
  if (!v.ok) return { ok: false, errors: v.errors };
  const d = v.data;

  const db = await getDb();
  const setObj: {
    title?: string;
    description?: string | null;
    scheduledStartAt?: Date;
    scheduledEndAt?: Date | null;
    timezone?: string | null;
    roomId?: string | null;
    status?: string;
    scenePresetId?: number | null;
    defaultTimelineTemplateId?: number | null;
    showPackageId?: number | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (d.title !== undefined) setObj.title = d.title;
  if (d.description !== undefined) setObj.description = d.description;
  if (d.scheduledStartIso !== undefined) setObj.scheduledStartAt = new Date(d.scheduledStartIso);
  if (d.scheduledEndIso !== undefined) setObj.scheduledEndAt = d.scheduledEndIso ? new Date(d.scheduledEndIso) : null;
  if (d.timezone !== undefined) setObj.timezone = d.timezone;
  if (d.roomId !== undefined) setObj.roomId = d.roomId;
  if (d.status !== undefined) setObj.status = d.status;
  if (d.scenePresetId !== undefined) setObj.scenePresetId = d.scenePresetId;
  if (d.defaultTimelineTemplateId !== undefined) setObj.defaultTimelineTemplateId = d.defaultTimelineTemplateId;
  if (d.showPackageId !== undefined) setObj.showPackageId = d.showPackageId;

  await db
    .update(meetBroadcastEvents)
    .set(setObj)
    .where(and(eq(meetBroadcastEvents.id, id), eq(meetBroadcastEvents.userId, userId)));

  incrementBroadcastEventUpdate({ userId, sessionId: null, roomId: existing.roomId });
  broadcastAudit("broadcast_event_updated", { userId, eventId: id });
  return { ok: true };
}

export async function deleteBroadcastEvent(id: number, userId: number): Promise<boolean> {
  if (!(await getBroadcastEventById(id, userId))) return false;
  const db = await getDb();
  await db.delete(meetBroadcastEvents).where(and(eq(meetBroadcastEvents.id, id), eq(meetBroadcastEvents.userId, userId)));
  incrementBroadcastEventDelete({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_event_deleted", { userId, eventId: id });
  return true;
}

export async function updateBroadcastEventStatus(
  id: number,
  userId: number,
  status: BroadcastEvent["status"]
): Promise<boolean> {
  const existing = await getBroadcastEventById(id, userId);
  if (!existing) return false;
  const db = await getDb();
  await db
    .update(meetBroadcastEvents)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(meetBroadcastEvents.id, id), eq(meetBroadcastEvents.userId, userId)));
  broadcastAudit("broadcast_event_updated", { userId, eventId: id, status });
  return true;
}

export async function attachEventToBroadcastSession(params: {
  broadcastSessionId: number;
  broadcastEventId: number;
  userId: number;
}): Promise<boolean> {
  const db = await getDb();
  const ev = await getBroadcastEventById(params.broadcastEventId, params.userId);
  if (!ev) return false;
  const sess = await db
    .select()
    .from(meetBroadcastSessions)
    .where(
      and(eq(meetBroadcastSessions.id, params.broadcastSessionId), eq(meetBroadcastSessions.userId, params.userId))
    )
    .limit(1);
  if (!sess[0]) return false;
  await db
    .update(meetBroadcastSessions)
    .set({ broadcastEventId: params.broadcastEventId, updatedAt: new Date() })
    .where(eq(meetBroadcastSessions.id, params.broadcastSessionId));
  return true;
}

export type BroadcastEventLaunchConfig = {
  event: BroadcastEvent;
  roomId: string;
  scenePresetId: number | null;
  scenePresetName: string | null;
  sceneSnapshot: Awaited<ReturnType<typeof resolveBroadcastStartScene>>["snapshot"];
  timelineTemplateId: number | null;
  timelineTemplateName: string | null;
  schedulePreview: {
    countdown: import("./broadcast-schedule").BroadcastCountdownConfig;
    actions: import("./broadcast-schedule").BroadcastScheduledAction[];
    automationEnabled: boolean;
  } | null;
  /** Stored calendar link only — no live external fetch. */
  calendarLink: BroadcastCalendarLinkSummary | null;
  /** Resolved show package used for defaults (linked event package, else user default). */
  appliedShowPackageId: number | null;
  showPackageSummary: BroadcastShowPackageSummary | null;
  overlayPackSummary: OverlayPackSummaryPayload | null;
  guestCardPackSummary: GuestCardPackSummaryPayload | null;
  defaultBrandingJson: Record<string, unknown> | null;
};

export type PrepareLaunchOverrides = {
  roomId?: string | null;
  scenePresetId?: number | null;
  defaultTimelineTemplateId?: number | null;
};

export async function prepareBroadcastEventLaunch(
  userId: number,
  eventId: number,
  overrides?: PrepareLaunchOverrides
): Promise<{ ok: true; config: BroadcastEventLaunchConfig } | { ok: false; errors: string[] }> {
  const event = await getBroadcastEventById(eventId, userId);
  if (!event) return { ok: false, errors: ["event_not_found"] };

  let linkedPkg =
    event.showPackageId != null && Number.isFinite(Number(event.showPackageId))
      ? await getBroadcastShowPackageById(Number(event.showPackageId), userId)
      : null;
  if (event.showPackageId != null && !linkedPkg) {
    linkedPkg = null;
  }
  const fallbackDefault = !linkedPkg ? await getDefaultShowPackageForUser(userId) : null;
  const activePkg = linkedPkg ?? fallbackDefault ?? null;
  const pkgDefaults = buildLaunchDefaultsFromShowPackage(activePkg);

  const effective = resolveEffectiveLaunchFields({ event, packageDefaults: pkgDefaults, overrides });
  if (!effective.roomId?.trim()) return { ok: false, errors: ["event_room_required"] };

  const syntheticEvent: BroadcastEvent = {
    ...event,
    roomId: effective.roomId,
    scenePresetId: effective.scenePresetId,
    defaultTimelineTemplateId: effective.defaultTimelineTemplateId,
  };

  let sceneRes: Awaited<ReturnType<typeof resolveBroadcastStartScene>>;
  try {
    sceneRes = await resolveBroadcastStartScene({
      userId,
      scenePresetId: syntheticEvent.scenePresetId ?? undefined,
      legacyLayoutMode: "grid",
    });
  } catch {
    return { ok: false, errors: ["scene_resolve_failed"] };
  }

  let schedulePreview: BroadcastEventLaunchConfig["schedulePreview"] = null;
  let timelineTemplateId: number | null = syntheticEvent.defaultTimelineTemplateId;
  let timelineTemplateName: string | null = null;

  if (syntheticEvent.defaultTimelineTemplateId != null) {
    const tpl = await getTimelineTemplateById(syntheticEvent.defaultTimelineTemplateId, userId);
    if (!tpl) {
      return { ok: false, errors: ["timeline_template_not_found"] };
    }
    timelineTemplateName = tpl.name;
    const shifted = shiftTemplateTimesRelativeToEventStart(event.scheduledStartIso, tpl.template);
    schedulePreview = {
      countdown: {
        visible: tpl.template.countdown.visible,
        position: tpl.template.countdown.position ?? "top_right",
        label: tpl.template.countdown.label,
        accentHex: tpl.template.countdown.accentHex,
        targetTimeIso: tpl.template.countdown.visible ? shifted.targetTimeIso : undefined,
      },
      actions: shifted.actions,
      automationEnabled: tpl.template.automationEnabled !== false,
    };
  }

  incrementBroadcastEventPrepareLaunch({ userId, roomId: effective.roomId, sessionId: null });
  broadcastAudit("broadcast_event_prepare_launch", { userId, eventId, roomId: effective.roomId });

  const calRow = await getBroadcastCalendarLinkByBroadcastEventId(eventId, userId);

  let overlayPackSummary: OverlayPackSummaryPayload | null = null;
  if (activePkg?.defaultOverlayPackId != null) {
    const op = await getBroadcastOverlayPackById(activePkg.defaultOverlayPackId, userId);
    if (op) overlayPackSummary = summarizeBroadcastOverlayPack(op);
  }
  let guestCardPackSummary: GuestCardPackSummaryPayload | null = null;
  if (activePkg?.defaultGuestCardPackId != null) {
    const gp = await getBroadcastGuestCardPackById(activePkg.defaultGuestCardPackId, userId);
    if (gp) guestCardPackSummary = { id: gp.id, name: gp.name, cardCount: gp.guestCardsJson.cards.length };
  }

  return {
    ok: true,
    config: {
      event,
      roomId: effective.roomId.trim(),
      scenePresetId: syntheticEvent.scenePresetId,
      scenePresetName: sceneRes.snapshot.appliedPresetName ?? null,
      sceneSnapshot: sceneRes.snapshot,
      timelineTemplateId,
      timelineTemplateName,
      schedulePreview,
      calendarLink: calRow ? toBroadcastCalendarLinkSummary(calRow) : null,
      appliedShowPackageId: activePkg?.id ?? null,
      showPackageSummary: activePkg ? summarizeBroadcastShowPackage(activePkg) : null,
      overlayPackSummary,
      guestCardPackSummary,
      defaultBrandingJson: activePkg?.defaultBrandingJson ?? null,
    },
  };
}
