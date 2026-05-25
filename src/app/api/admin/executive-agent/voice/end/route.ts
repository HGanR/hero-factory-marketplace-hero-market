import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { endExecutiveVoiceSession } from "@/lib/executive-agent/executive-agent-voice-store";
import { VoiceEndBodySchema } from "@/lib/executive-agent/executive-agent-voice-request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = VoiceEndBodySchema.parse(await req.json());
    const db = await getDb();
    const ok = await endExecutiveVoiceSession(db, body.sessionId, adminUserId);
    if (!ok) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND_OR_ALREADY_ENDED" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "VOICE_END_FAILED", message: msg }, { status: 500 });
  }
}
