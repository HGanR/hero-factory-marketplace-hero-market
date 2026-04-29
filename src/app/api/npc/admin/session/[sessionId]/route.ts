import { NextRequest, NextResponse } from "next/server";
import { requireNpcAdminSession } from "@/lib/admin/require-npc-admin";
import { getMessagesForSession, getSessionBySessionId } from "@/lib/npc/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!(await requireNpcAdminSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  const session = await getSessionBySessionId(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const messages = await getMessagesForSession(session.id);
  return NextResponse.json({
    session,
    messages,
  });
}
