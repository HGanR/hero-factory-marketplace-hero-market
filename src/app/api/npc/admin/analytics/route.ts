import { NextRequest, NextResponse } from "next/server";
import { requireNpcAdminSession } from "@/lib/admin/require-npc-admin";
import { getNpcAnalytics, getSystemAnalytics } from "@/lib/npc/db";

export async function GET(req: NextRequest) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const npcId = req.nextUrl.searchParams.get("npcId");
  if (npcId) {
    const analytics = await getNpcAnalytics(npcId);
    return NextResponse.json({ analytics });
  }
  const analytics = await getSystemAnalytics();
  return NextResponse.json({ analytics });
}
