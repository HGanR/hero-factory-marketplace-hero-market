import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiVoices } from "@/lib/db/schema";
import { filterPresetVoices } from "@/lib/voices/presets";

/** List preset + user custom voices. */
export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);

    const u = new URL(req.url);
    const language = u.searchParams.get("language") ?? "all";
    const accent = u.searchParams.get("accent") ?? "all";
    const gender = u.searchParams.get("gender") ?? "all";
    const highQualityOnly = u.searchParams.get("highQualityOnly") === "true";
    const search = u.searchParams.get("search") ?? "";
    const includeCustom = u.searchParams.get("includeCustom") !== "false";

    const presetVoices = filterPresetVoices({
      language: language === "all" ? undefined : language,
      accent: accent === "all" ? undefined : accent,
      gender: gender === "all" ? undefined : gender,
      highQualityOnly,
      search: search || undefined,
    });
    const voicesWithCustom = presetVoices.map((v) => ({ ...v, isCustom: false }));

    if (includeCustom) {
      await ensureAgentTables();
      const db = await getDb();
      const customRows = await db
        .select({ id: aiVoices.id, name: aiVoices.name, provider: aiVoices.provider, providerVoiceId: aiVoices.providerVoiceId })
        .from(aiVoices)
        .where(eq(aiVoices.userId, userId))
        .limit(50);

      const customVoices = customRows.map((r) => ({
        id: r.providerVoiceId,
        name: r.name,
        description: "My custom voice",
        provider: r.provider,
        providerVoiceId: r.providerVoiceId,
        language: "English",
        accent: "Custom",
        gender: "neutral",
        highQuality: true,
        isCustom: true,
      }));
      const combined = [...customVoices, ...voicesWithCustom];
      return NextResponse.json({ voices: combined });
    }

    return NextResponse.json({ voices: voicesWithCustom });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("voices GET error:", err);
    return NextResponse.json({ error: "Failed to list voices" }, { status: 500 });
  }
}

/** Create custom voice (multipart: name, consent, consentText, files). */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Voice cloning not configured. Set ELEVENLABS_API_KEY." }, { status: 503 });

    const formData = await req.formData();
    const name = String(formData.get("name") ?? "").trim().slice(0, 100) || "My Voice";
    const consentChecked = formData.get("consent") === "true";
    const consentText = String(formData.get("consentText") ?? "").trim();

    if (!consentChecked) {
      return NextResponse.json({ error: "Consent required. You must agree to the terms." }, { status: 400 });
    }

    const files: { filename: string; mime: string; bytes: Buffer }[] = [];
    for (const [key, val] of formData.entries()) {
      if (val instanceof File && (key === "file" || key === "files" || key.startsWith("file"))) {
        const buf = Buffer.from(await val.arrayBuffer());
        files.push({ filename: val.name || "audio.mp3", mime: val.type || "audio/mpeg", bytes: buf });
      }
    }

    if (files.length < 1) {
      return NextResponse.json({ error: "At least one audio file required" }, { status: 400 });
    }

    const { createElevenLabsVoice } = await import("@/lib/voices/elevenlabs");
    const out = await createElevenLabsVoice({
      name: `TroothHertz-${userId}-${Date.now()}`,
      files,
      removeBackgroundNoise: true,
    });

    const db = await getDb();
    await ensureAgentTables();
    const id = crypto.randomUUID();
    await db.insert(aiVoices).values({
      id,
      userId,
      name,
      provider: "elevenlabs",
      providerVoiceId: out.providerVoiceId,
      isCustom: true,
      status: out.status,
      consent: JSON.stringify({
        checked: true,
        text: consentText,
        timestamp: new Date().toISOString(),
      }),
    } as any);

    return NextResponse.json({
      id,
      voiceId: out.providerVoiceId,
      provider: "elevenlabs",
      status: out.status,
      name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("voices POST error:", err);
    return NextResponse.json({ error: msg || "Failed to create voice" }, { status: 500 });
  }
}
