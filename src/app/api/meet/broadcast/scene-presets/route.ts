import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { createScenePreset, listScenePresets } from "@/lib/meet/broadcast-scene-presets";
import { getDefaultSceneConfig, type BroadcastSceneConfig } from "@/lib/meet/broadcast-scene";

export async function GET() {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listScenePresets(userId);
    return NextResponse.json({
      presets: rows.map((r) => ({
        id: r.id,
        name: r.name,
        config: r.configJson as BroadcastSceneConfig,
        isDefault: Boolean(r.isDefault),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (e) {
    console.error("[meet/broadcast/scene-presets GET]", e);
    return NextResponse.json({ error: "Failed to load presets" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { name?: string; config?: BroadcastSceneConfig; isDefault?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const row = await createScenePreset(userId, {
      name: String(body.name ?? ""),
      config: (body.config ?? getDefaultSceneConfig()) as BroadcastSceneConfig,
      isDefault: body.isDefault,
    });
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
    console.error("[meet/broadcast/scene-presets POST]", e);
    return NextResponse.json({ error: "Failed to create preset" }, { status: 503 });
  }
}
