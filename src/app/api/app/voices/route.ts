import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiVoices } from "@/lib/db/schema";
import { filterPresetVoices } from "@/lib/voices/presets";
import { getSelfHostedTtsHealthReport } from "@/lib/voices/self-hosted-tts-health";
import {
  createClonedVoiceFromClips,
  CustomCloneProvider,
  CUSTOM_CLONE_PROVIDERS,
  getVoiceEnginesStatus,
  VoiceProviderHttpError,
  VOICE_PROVIDER_ELEVENLABS,
  VOICE_PROVIDER_SELF_HOSTED_TTS,
} from "@/lib/voices/voice-provider";

/** List preset + user custom voices + engine configuration (non-secret). */
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
    const includeSelfHostedHealth = u.searchParams.get("includeSelfHostedHealth") === "1";

    const presetVoices = filterPresetVoices({
      language: language === "all" ? undefined : language,
      accent: accent === "all" ? undefined : accent,
      gender: gender === "all" ? undefined : gender,
      highQualityOnly,
      search: search || undefined,
    });
    const voicesWithCustom = presetVoices.map((v) => ({ ...v, isCustom: false }));

    const engineStatus = getVoiceEnginesStatus();
    const selfHostedHealth = includeSelfHostedHealth ? await getSelfHostedTtsHealthReport() : null;

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
      return NextResponse.json({
        voices: combined,
        engineStatus,
        ...(selfHostedHealth ? { selfHostedHealth } : {}),
      });
    }

    return NextResponse.json({
      voices: voicesWithCustom,
      engineStatus,
      ...(selfHostedHealth ? { selfHostedHealth } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("voices GET error:", err);
    return NextResponse.json({ error: "Failed to list voices" }, { status: 500 });
  }
}

function parseCloneProvider(raw: string | null): CustomCloneProvider {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === VOICE_PROVIDER_SELF_HOSTED_TTS) return VOICE_PROVIDER_SELF_HOSTED_TTS;
  return VOICE_PROVIDER_ELEVENLABS;
}

/** Create custom voice (multipart: name, consent, consentText, files, cloneProvider). */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);

    const formData = await req.formData();
    const cloneProvider = parseCloneProvider(typeof formData.get("cloneProvider") === "string" ? formData.get("cloneProvider") : null);
    if (!CUSTOM_CLONE_PROVIDERS.includes(cloneProvider)) {
      return NextResponse.json({ error: "Invalid cloneProvider." }, { status: 400 });
    }

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

    let out: { providerVoiceId: string; status: "active" | "pending" };
    try {
      out = await createClonedVoiceFromClips({
        provider: cloneProvider,
        displayName: `TroothHertz-${userId}-${Date.now()}`,
        files,
      });
    } catch (e) {
      if (e instanceof VoiceProviderHttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const db = await getDb();
    await ensureAgentTables();
    const id = crypto.randomUUID();
    const storedProvider = cloneProvider === VOICE_PROVIDER_SELF_HOSTED_TTS ? VOICE_PROVIDER_SELF_HOSTED_TTS : VOICE_PROVIDER_ELEVENLABS;
    await db.insert(aiVoices).values({
      id,
      userId,
      name,
      provider: storedProvider,
      providerVoiceId: out.providerVoiceId,
      isCustom: true,
      status: out.status,
      consent: JSON.stringify({
        checked: true,
        text: consentText,
        cloneProvider: storedProvider,
        timestamp: new Date().toISOString(),
      }),
    } as any);

    return NextResponse.json({
      id,
      voiceId: out.providerVoiceId,
      provider: storedProvider,
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
