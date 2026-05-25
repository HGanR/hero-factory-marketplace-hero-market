import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  getExecutiveVoiceSessionForAdmin,
  listExecutiveVoiceTurnsForSession,
} from "@/lib/executive-agent/executive-agent-voice-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await ctx.params;
  if (!sessionId || sessionId.length > 40) {
    return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 });
  }
  try {
    const db = await getDb();
    const session = await getExecutiveVoiceSessionForAdmin(db, sessionId, adminUserId);
    if (!session) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const turns = await listExecutiveVoiceTurnsForSession(db, sessionId, adminUserId, 120);
    return NextResponse.json({
      session,
      turns,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "VOICE_GET_FAILED", message: msg }, { status: 500 });
  }
}
