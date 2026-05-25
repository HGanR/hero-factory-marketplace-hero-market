import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { getSkipperOutputVoiceForUser } from "@/lib/voices/executive-skipper-output-voice";
import {
  synthesizePreviewAudio,
  VoiceProviderHttpError,
  VOICE_PROVIDER_ELEVENLABS,
  VOICE_PROVIDER_OPENAI,
  VOICE_PROVIDER_SELF_HOSTED_TTS,
} from "@/lib/voices/voice-provider";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1).max(8000),
  voiceId: z.string().trim().min(1).max(128).optional(),
  voiceProvider: z.enum([VOICE_PROVIDER_SELF_HOSTED_TTS, VOICE_PROVIDER_ELEVENLABS, VOICE_PROVIDER_OPENAI]).optional(),
});

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const db = await getDb();
    const fromDb = await getSkipperOutputVoiceForUser(db, adminUserId);
    const voiceId = body.voiceId?.trim() || fromDb?.voiceId;
    const voiceProvider = (body.voiceProvider || fromDb?.voiceProvider)?.trim().toLowerCase();

    const ttsEnv = (process.env.EXECUTIVE_VOICE_TTS_PROVIDER ?? "").trim().toLowerCase();
    if (ttsEnv === "elevenlabs") {
      if (voiceProvider !== VOICE_PROVIDER_ELEVENLABS) {
        return NextResponse.json(
          {
            error: "TTS_POLICY_MISMATCH",
            message:
              "EXECUTIVE_VOICE_TTS_PROVIDER=elevenlabs requires SKIPPER in AI Agency to use voiceProvider elevenlabs with a valid ElevenLabs voice id.",
          },
          { status: 400 },
        );
      }
      if (!process.env.ELEVENLABS_API_KEY?.trim()) {
        return NextResponse.json(
          { error: "TTS_NOT_CONFIGURED", message: "EXECUTIVE_VOICE_TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY is missing." },
          { status: 503 },
        );
      }
    }
    if (ttsEnv === "openai") {
      if (voiceProvider !== VOICE_PROVIDER_OPENAI) {
        return NextResponse.json(
          {
            error: "TTS_POLICY_MISMATCH",
            message:
              "EXECUTIVE_VOICE_TTS_PROVIDER=openai requires SKIPPER in AI Agency to use a preset voice (voiceProvider openai) with a valid OpenAI TTS voice id.",
          },
          { status: 400 },
        );
      }
      if (!process.env.OPENAI_API_KEY?.trim()) {
        return NextResponse.json(
          { error: "TTS_NOT_CONFIGURED", message: "EXECUTIVE_VOICE_TTS_PROVIDER=openai but OPENAI_API_KEY is missing." },
          { status: 503 },
        );
      }
    }

    if (!voiceId || !voiceProvider) {
      return NextResponse.json({ error: "NO_AGENT_VOICE", message: "No SKIPPER voice configured." }, { status: 404 });
    }
    if (
      voiceProvider !== VOICE_PROVIDER_SELF_HOSTED_TTS &&
      voiceProvider !== VOICE_PROVIDER_ELEVENLABS &&
      voiceProvider !== VOICE_PROVIDER_OPENAI
    ) {
      return NextResponse.json({ error: "UNSUPPORTED_PROVIDER" }, { status: 400 });
    }
    const { buffer, contentType } = await synthesizePreviewAudio({
      provider: voiceProvider,
      voiceId,
      text: body.text,
    });
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": contentType || "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    if (e instanceof VoiceProviderHttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "SPEAK_FAILED", message: msg }, { status: 500 });
  }
}
