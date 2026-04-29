import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { deleteScenePreset, updateScenePreset } from "@/lib/meet/broadcast-scene-presets";
import type { BroadcastSceneConfig } from "@/lib/meet/broadcast-scene";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  let body: { name?: string; config?: BroadcastSceneConfig; isDefault?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const row = await updateScenePreset(userId, id, {
      name: body.name,
      config: body.config,
      isDefault: body.isDefault,
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      preset: {
        id: row.id,
        name: row.name,
        config: row.configJson as BroadcastSceneConfig,
        isDefault: Boolean(row.isDefault),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "broadcast_scene_invalid" || err.code === "validation_error") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[meet/broadcast/scene-presets PATCH]", e);
    return NextResponse.json({ error: "Failed to update preset" }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const ok = await deleteScenePreset(userId, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[meet/broadcast/scene-presets DELETE]", e);
    return NextResponse.json({ error: "Failed to delete preset" }, { status: 503 });
  }
}
