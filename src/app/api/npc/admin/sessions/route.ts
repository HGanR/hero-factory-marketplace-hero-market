import { NextRequest, NextResponse } from "next/server";
import { requireNpcAdminSession } from "@/lib/admin/require-npc-admin";
import { getSessionsByNpcId } from "@/lib/npc/db";

export async function GET(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const npcId = req.nextUrl.searchParams.get("npcId");
  if (!npcId) {
    return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
  }
  const sessions = await getSessionsByNpcId(npcId);
  return NextResponse.json({ sessions });
}
