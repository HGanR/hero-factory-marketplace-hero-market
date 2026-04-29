import { NextResponse } from "next/server";
import { getNpcByNpcId, getNpcRowByNpcId, getKnowledgeForNpc } from "@/lib/npc/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ npcId: string }> }
) {
  const { npcId } = await params;
  const profile = await getNpcByNpcId(npcId);
  if (!profile) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  const npcRow = await getNpcRowByNpcId(npcId);
  const knowledge = npcRow ? await getKnowledgeForNpc(npcRow.id) : [];

  return NextResponse.json({
    profile: {
      ...profile,
      knowledgeTopics: knowledge.map((k) => k.topic),
    },
  });
}
