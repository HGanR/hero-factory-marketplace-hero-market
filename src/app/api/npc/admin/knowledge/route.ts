import { NextRequest, NextResponse } from "next/server";
import { requireNpcAdminSession } from "@/lib/admin/require-npc-admin";
import { addKnowledge, getNpcRowByNpcId } from "@/lib/npc/db";
import type { KnowledgeEntry } from "@/lib/npc/types";

export async function POST(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const npcId = String(body?.npcId || "").trim();
  const entries = Array.isArray(body?.entries) ? (body.entries as KnowledgeEntry[]) : [];

  if (!npcId || entries.length === 0) {
    return NextResponse.json({ error: "Missing npcId or entries" }, { status: 400 });
  }

  const npcRow = await getNpcRowByNpcId(npcId);
  if (!npcRow) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  await addKnowledge(npcRow.id, entries);

  return NextResponse.json({ success: true });
}
