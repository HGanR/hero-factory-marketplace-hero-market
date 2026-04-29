import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastScenePresets } from "@/lib/db/schema";
import { validateSceneConfig, type BroadcastSceneConfig } from "./broadcast-scene";

export type ScenePresetRow = typeof meetBroadcastScenePresets.$inferSelect;

export type CreateScenePresetInput = {
  name: string;
  config: BroadcastSceneConfig;
  isDefault?: boolean;
};

export type UpdateScenePresetInput = {
  name?: string;
  config?: BroadcastSceneConfig;
  isDefault?: boolean;
};

async function clearDefaultForUser(userId: number): Promise<void> {
  const db = await getDb();
  await db
    .update(meetBroadcastScenePresets)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(meetBroadcastScenePresets.userId, userId));
}

export async function listScenePresets(userId: number): Promise<ScenePresetRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(meetBroadcastScenePresets)
    .where(eq(meetBroadcastScenePresets.userId, userId))
    .orderBy(desc(meetBroadcastScenePresets.updatedAt));
}

export async function getScenePresetForUser(userId: number, id: number): Promise<ScenePresetRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastScenePresets)
    .where(and(eq(meetBroadcastScenePresets.userId, userId), eq(meetBroadcastScenePresets.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDefaultScenePreset(userId: number): Promise<ScenePresetRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastScenePresets)
    .where(and(eq(meetBroadcastScenePresets.userId, userId), eq(meetBroadcastScenePresets.isDefault, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createScenePreset(userId: number, input: CreateScenePresetInput): Promise<ScenePresetRow> {
  const v = validateSceneConfig(input.config, { partial: false });
  if (!v.ok) throw Object.assign(new Error(v.errors.join("; ")), { code: "broadcast_scene_invalid" });

  const name = input.name.trim().slice(0, 120);
  if (!name) throw Object.assign(new Error("name is required"), { code: "validation_error" });

  const db = await getDb();
  if (input.isDefault) await clearDefaultForUser(userId);

  const [ins] = await db
    .insert(meetBroadcastScenePresets)
    .values({
      userId,
      name,
      configJson: v.config,
      isDefault: Boolean(input.isDefault),
    })
    .$returningId();

  const id = ins?.id != null ? Number(ins.id) : NaN;
  if (!Number.isFinite(id)) throw new Error("Failed to create preset");

  const row = await getScenePresetForUser(userId, id);
  if (!row) throw new Error("Preset not found after insert");
  return row;
}

export async function updateScenePreset(
  userId: number,
  id: number,
  input: UpdateScenePresetInput
): Promise<ScenePresetRow | null> {
  const existing = await getScenePresetForUser(userId, id);
  if (!existing) return null;

  let configJson = existing.configJson as BroadcastSceneConfig;
  if (input.config != null) {
    const v = validateSceneConfig(input.config, { partial: true });
    if (!v.ok) throw Object.assign(new Error(v.errors.join("; ")), { code: "broadcast_scene_invalid" });
    configJson = v.config;
  }

  const name = input.name != null ? input.name.trim().slice(0, 120) : existing.name;
  if (!name) throw Object.assign(new Error("name cannot be empty"), { code: "validation_error" });

  const db = await getDb();
  if (input.isDefault) await clearDefaultForUser(userId);

  await db
    .update(meetBroadcastScenePresets)
    .set({
      name,
      configJson,
      isDefault: input.isDefault != null ? Boolean(input.isDefault) : existing.isDefault,
      updatedAt: new Date(),
    })
    .where(and(eq(meetBroadcastScenePresets.userId, userId), eq(meetBroadcastScenePresets.id, id)));

  return getScenePresetForUser(userId, id);
}

export async function deleteScenePreset(userId: number, id: number): Promise<boolean> {
  const existing = await getScenePresetForUser(userId, id);
  if (!existing) return false;
  const db = await getDb();
  await db
    .delete(meetBroadcastScenePresets)
    .where(and(eq(meetBroadcastScenePresets.userId, userId), eq(meetBroadcastScenePresets.id, id)));
  return true;
}
