import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { PRESET_VOICES } from "@/lib/voices/presets";

/** Generate TTS preview MP3. Supports OpenAI (presets) and ElevenLabs (custom). */
export async function POST(req: NextRequest) {
  try {
    requireUserId(req);

    const body = await req.json().catch(() => ({}));
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId.trim() : "";
    const provider = (typeof body?.provider === "string" ? body.provider.trim() : "") || "openai";
    const text = typeof body?.text === "string" ? body.text.slice(0, 200) : "Hello, this is a quick voice preview.";

    if (!voiceId) return NextResponse.json({ error: "voiceId required" }, { status: 400 });

    let providerVoiceId = voiceId;
    if (provider === "openai") {
      const preset = PRESET_VOICES.find((v) => v.id === voiceId || v.providerVoiceId === voiceId);
      providerVoiceId = preset?.providerVoiceId ?? voiceId;
    }

    if (provider === "elevenlabs") {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "Set ELEVENLABS_API_KEY for custom voice preview." }, { status: 503 });
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${providerVoiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.warn("ElevenLabs TTS error:", res.status, err);
        return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
      }
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, { headers: { "Content-Type": "audio/mpeg" } });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Set OPENAI_API_KEY for preset preview." }, { status: 503 });
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: providerVoiceId,
        input: text,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("OpenAI TTS error:", res.status, err);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("voices preview POST error:", err);
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}
