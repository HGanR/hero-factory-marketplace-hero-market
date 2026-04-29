import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUserId } from "@/lib/auth";
import { createNpc, listNpcsByOwner } from "@/lib/npc/db";
import type { NPCRole } from "@/lib/npc/types";
import { DEFAULT_PERSONALITY } from "@/lib/npc/engine";

/** GET: List NPCs owned by the current user */
export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const npcs = await listNpcsByOwner(userId);
    return NextResponse.json({ npcs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("app npcs GET error:", err);
    return NextResponse.json({ error: "Failed to list NPCs" }, { status: 500 });
  }
}

/** POST: Create a new NPC (user-owned) */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const name = String(body?.name || "").trim();
    const role = body?.role as NPCRole | undefined;
    if (!name || !role) {
      return NextResponse.json({ error: "Missing name or role" }, { status: 400 });
    }
    if (!["secretary", "avatar", "guide", "voice_agent"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const npcId = body?.npcId ? String(body.npcId).trim() : `user-${randomUUID()}`;
    const personality = body?.personality || DEFAULT_PERSONALITY;

    const npc = await createNpc({
      npcId,
      name,
      role,
      title: body?.title ? String(body.title).trim() : null,
      avatarEmoji: body?.avatarEmoji ? String(body.avatarEmoji) : "🤖",
      voiceStyle: body?.voiceStyle || "friendly",
      language: body?.language ? String(body.language).trim() || null : null,
      worldId: body?.worldId ? String(body.worldId) : null,
      greeting: body?.greeting ? String(body.greeting).trim() : null,
      farewell: body?.farewell ? String(body.farewell).trim() : null,
      personality,
      ownerId: userId,
    });

    return NextResponse.json({ npc });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("app npcs POST error:", err);
    return NextResponse.json({ error: "Failed to create NPC" }, { status: 500 });
  }
}
