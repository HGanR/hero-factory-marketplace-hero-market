import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import {
  synthesizePreviewAudio,
  VoiceProviderHttpError,
  VOICE_PROVIDER_ELEVENLABS,
  VOICE_PROVIDER_OPENAI,
  VOICE_PROVIDER_SELF_HOSTED_TTS,
} from "@/lib/voices/voice-provider";

/** Generate TTS preview: OpenAI presets, ElevenLabs custom, or self-hosted TTS. */
export async function POST(req: NextRequest) {
  try {
    requireUserId(req);

    const body = await req.json().catch(() => ({}));
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId.trim() : "";
    const providerRaw = (typeof body?.provider === "string" ? body.provider.trim() : "") || "openai";
    const text = typeof body?.text === "string" ? body.text.slice(0, 200) : "Hello, this is a quick voice preview.";

    if (!voiceId) return NextResponse.json({ error: "voiceId required" }, { status: 400 });

    const provider = providerRaw.toLowerCase();
    if (provider === VOICE_PROVIDER_SELF_HOSTED_TTS) {
      const { buffer, contentType } = await synthesizePreviewAudio({
        provider: VOICE_PROVIDER_SELF_HOSTED_TTS,
        voiceId,
        text,
      });
      return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
    }
    if (provider === VOICE_PROVIDER_ELEVENLABS) {
      const { buffer, contentType } = await synthesizePreviewAudio({
        provider: VOICE_PROVIDER_ELEVENLABS,
        voiceId,
        text,
      });
      return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
    }
    const { buffer, contentType } = await synthesizePreviewAudio({
      provider: VOICE_PROVIDER_OPENAI,
      voiceId,
      text,
    });
    return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (err instanceof VoiceProviderHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("voices preview POST error:", err);
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}
