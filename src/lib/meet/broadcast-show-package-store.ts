import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastShowPackages } from "@/lib/db/schema";
import { broadcastAudit } from "./broadcast-audit";
import {
  incrementBroadcastShowPackageApply,
  incrementBroadcastShowPackageCreate,
  incrementBroadcastShowPackageDelete,
  incrementBroadcastShowPackageUpdate,
} from "./broadcast-metrics";
import { summarizeBroadcastOverlayPack } from "./broadcast-overlay-packs";
import { getBroadcastOverlayPackById } from "./broadcast-overlay-pack-store";
import { getBroadcastGuestCardPackById } from "./broadcast-guest-card-pack-store";
import type { BroadcastShowPackage } from "./broadcast-show-packages";
import {
  buildLaunchDefaultsFromShowPackage,
  validateBroadcastShowPackage,
  summarizeBroadcastShowPackage,
  type GuestCardPackSummaryPayload,
  type OverlayPackSummaryPayload,
} from "./broadcast-show-packages";

function rowTo(row: typeof meetBroadcastShowPackages.$inferSelect): BroadcastShowPackage {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? null,
    scenePresetId: row.scenePresetId ?? null,
    timelineTemplateId: row.timelineTemplateId ?? null,
    defaultBrandingJson: (row.defaultBrandingJson as Record<string, unknown> | null) ?? null,
    defaultOverlayPackId: row.defaultOverlayPackId ?? null,
    defaultGuestCardPackId: row.defaultGuestCardPackId ?? null,
    defaultRoomId: row.defaultRoomId ?? null,
    isDefault: Boolean(row.isDefault),
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

async function clearDefaultShowPackagesExcept(userId: number, exceptId: number | null): Promise<void> {
  const db = await getDb();
  await db
    .update(meetBroadcastShowPackages)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(meetBroadcastShowPackages.userId, userId), eq(meetBroadcastShowPackages.isDefault, true)));
  if (exceptId != null) {
    await db
      .update(meetBroadcastShowPackages)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(meetBroadcastShowPackages.id, exceptId), eq(meetBroadcastShowPackages.userId, userId)));
  }
}

export async function getBroadcastShowPackageById(id: number, userId: number): Promise<BroadcastShowPackage | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastShowPackages)
    .where(and(eq(meetBroadcastShowPackages.id, id), eq(meetBroadcastShowPackages.userId, userId)))
    .limit(1);
  return rows[0] ? rowTo(rows[0]) : null;
}

export async function getDefaultShowPackageForUser(userId: number): Promise<BroadcastShowPackage | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastShowPackages)
    .where(and(eq(meetBroadcastShowPackages.userId, userId), eq(meetBroadcastShowPackages.isDefault, true)))
    .orderBy(desc(meetBroadcastShowPackages.updatedAt))
    .limit(1);
  return rows[0] ? rowTo(rows[0]) : null;
}

export async function listBroadcastShowPackagesForUser(userId: number, limit = 50): Promise<BroadcastShowPackage[]> {
  const db = await getDb();
  const cap = Math.min(100, Math.max(1, limit));
  const rows = await db
    .select()
    .from(meetBroadcastShowPackages)
    .where(eq(meetBroadcastShowPackages.userId, userId))
    .orderBy(desc(meetBroadcastShowPackages.updatedAt))
    .limit(cap);
  return rows.map(rowTo);
}

export async function createBroadcastShowPackage(
  userId: number,
  body: Record<string, unknown>
): Promise<{ ok: true; id: number } | { ok: false; errors: string[] }> {
  const v = validateBroadcastShowPackage(body, "create");
  if (!v.ok) return { ok: false, errors: v.errors };
  const d = v.data;
  if (!d.name) return { ok: false, errors: ["name required"] };
  const db = await getDb();
  const [ins] = await db
    .insert(meetBroadcastShowPackages)
    .values({
      userId,
      name: d.name,
      description: d.description ?? null,
      scenePresetId: d.scenePresetId ?? null,
      timelineTemplateId: d.timelineTemplateId ?? null,
      defaultBrandingJson: d.defaultBrandingJson ?? null,
      defaultOverlayPackId: d.defaultOverlayPackId ?? null,
      defaultGuestCardPackId: d.defaultGuestCardPackId ?? null,
      defaultRoomId: d.defaultRoomId ?? null,
      isDefault: Boolean(d.isDefault),
    })
    .$returningId();
  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) return { ok: false, errors: ["insert_failed"] };
  if (d.isDefault) await clearDefaultShowPackagesExcept(userId, id);
  incrementBroadcastShowPackageCreate({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_show_package_created", { userId, showPackageId: id, name: d.name.slice(0, 120) });
  return { ok: true, id };
}

export async function updateBroadcastShowPackage(
  id: number,
  userId: number,
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (!(await getBroadcastShowPackageById(id, userId))) return { ok: false, errors: ["not_found"] };
  const v = validateBroadcastShowPackage(body, "patch");
  if (!v.ok) return { ok: false, errors: v.errors };
  const d = v.data;
  const db = await getDb();
  const setObj: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) setObj.name = d.name;
  if (d.description !== undefined) setObj.description = d.description;
  if (d.scenePresetId !== undefined) setObj.scenePresetId = d.scenePresetId;
  if (d.timelineTemplateId !== undefined) setObj.timelineTemplateId = d.timelineTemplateId;
  if (d.defaultBrandingJson !== undefined) setObj.defaultBrandingJson = d.defaultBrandingJson;
  if (d.defaultOverlayPackId !== undefined) setObj.defaultOverlayPackId = d.defaultOverlayPackId;
  if (d.defaultGuestCardPackId !== undefined) setObj.defaultGuestCardPackId = d.defaultGuestCardPackId;
  if (d.defaultRoomId !== undefined) setObj.defaultRoomId = d.defaultRoomId;
  if (d.isDefault !== undefined) setObj.isDefault = d.isDefault;
  await db
    .update(meetBroadcastShowPackages)
    .set(setObj as typeof meetBroadcastShowPackages.$inferInsert)
    .where(and(eq(meetBroadcastShowPackages.id, id), eq(meetBroadcastShowPackages.userId, userId)));
  if (d.isDefault) await clearDefaultShowPackagesExcept(userId, id);
  incrementBroadcastShowPackageUpdate({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_show_package_updated", { userId, showPackageId: id });
  return { ok: true };
}

export async function deleteBroadcastShowPackage(id: number, userId: number): Promise<boolean> {
  if (!(await getBroadcastShowPackageById(id, userId))) return false;
  const db = await getDb();
  await db
    .delete(meetBroadcastShowPackages)
    .where(and(eq(meetBroadcastShowPackages.id, id), eq(meetBroadcastShowPackages.userId, userId)));
  incrementBroadcastShowPackageDelete({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_show_package_deleted", { userId, showPackageId: id });
  return true;
}

export function recordBroadcastShowPackageApplied(userId: number, showPackageId: number): void {
  incrementBroadcastShowPackageApply({ userId, sessionId: null, roomId: null, reason: String(showPackageId) });
}

/** Resolved defaults and summaries for a single show package (no event context). */
export async function getShowPackagePrepareDefaults(
  userId: number,
  showPackageId: number
): Promise<
  | { ok: false; errors: string[] }
  | {
      ok: true;
      showPackageSummary: ReturnType<typeof summarizeBroadcastShowPackage>;
      launchDefaults: NonNullable<ReturnType<typeof buildLaunchDefaultsFromShowPackage>>;
      overlayPackSummary: OverlayPackSummaryPayload | null;
      guestCardPackSummary: GuestCardPackSummaryPayload | null;
    }
> {
  const pkg = await getBroadcastShowPackageById(showPackageId, userId);
  if (!pkg) return { ok: false, errors: ["not_found"] };
  const launchDefaults = buildLaunchDefaultsFromShowPackage(pkg);
  if (!launchDefaults) return { ok: false, errors: ["package_invalid"] };

  let overlayPackSummary: OverlayPackSummaryPayload | null = null;
  if (pkg.defaultOverlayPackId != null) {
    const op = await getBroadcastOverlayPackById(pkg.defaultOverlayPackId, userId);
    if (op) overlayPackSummary = summarizeBroadcastOverlayPack(op);
  }
  let guestCardPackSummary: GuestCardPackSummaryPayload | null = null;
  if (pkg.defaultGuestCardPackId != null) {
    const gp = await getBroadcastGuestCardPackById(pkg.defaultGuestCardPackId, userId);
    if (gp) guestCardPackSummary = { id: gp.id, name: gp.name, cardCount: gp.guestCardsJson.cards.length };
  }

  return {
    ok: true,
    showPackageSummary: summarizeBroadcastShowPackage(pkg),
    launchDefaults,
    overlayPackSummary,
    guestCardPackSummary,
  };
}
