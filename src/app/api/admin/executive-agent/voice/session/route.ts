import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { persistExecutiveVoiceSessionStart } from "@/lib/executive-agent/executive-agent-voice-store";
import { VoiceStartBodySchema } from "@/lib/executive-agent/executive-agent-voice-request";
import { startExecutiveVoiceSessionPayload } from "@/lib/executive-agent/executive-voice-provider";

export const dynamic = "force-dynamic";

/** @deprecated Prefer POST /api/admin/executive-agent/voice/start — same behavior with DB persistence. */
export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = VoiceStartBodySchema.parse(await req.json().catch(() => ({})));
    const payload = startExecutiveVoiceSessionPayload({
      provider: body.provider ?? undefined,
      locale: body.locale ?? undefined,
    });
    const db = await getDb();
    await persistExecutiveVoiceSessionStart(db, adminUserId, payload);
    return NextResponse.json({
      sessionId: payload.sessionId,
      provider: payload.provider,
      transcript: null,
      responseAudioUrl: null,
      capabilities: [
        "text",
        "transcript_capture",
        "browser_stt",
        "browser_tts",
        "future:openai_realtime",
        "future:elevenlabs",
        "future:browser_webrtc",
      ],
      status: payload.status,
      inputMode: payload.inputMode,
      outputMode: payload.outputMode,
      expiresAt: payload.expiresAt,
      clientConfig: payload.clientConfig,
      adminUserId,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    throw e;
  }
}
