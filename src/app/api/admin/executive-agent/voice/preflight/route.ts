import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { isOpenAiSttTranscriptionConfigured, getOpenAiSttModel } from "@/lib/voices/openai-stt-client";
import { isSelfHostedSttEngineConfigured } from "@/lib/voices/stt-provider";

export const dynamic = "force-dynamic";

function trueish(v: string | undefined): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openaiKey = isOpenAiSttTranscriptionConfigured();
  const elevenlabsKey = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const sttEnv = (process.env.EXECUTIVE_VOICE_STT_PROVIDER ?? "").trim() || null;
  const ttsEnv = (process.env.EXECUTIVE_VOICE_TTS_PROVIDER ?? "").trim() || null;
  const selfHostedSttConfigured = isSelfHostedSttEngineConfigured();

  const nextSteps: string[] = [];
  if (!openaiKey && !selfHostedSttConfigured) {
    nextSteps.push("Set OPENAI_API_KEY for cloud STT, or enable SELF_HOSTED_STT_ENABLED and SELF_HOSTED_STT_BASE_URL for self-hosted STT.");
  }
  if (sttEnv?.toLowerCase() === "openai" && !openaiKey) {
    nextSteps.push("EXECUTIVE_VOICE_STT_PROVIDER is openai but OPENAI_API_KEY is missing.");
  }
  if (ttsEnv?.toLowerCase() === "openai" && !openaiKey) {
    nextSteps.push("EXECUTIVE_VOICE_TTS_PROVIDER=openai requires OPENAI_API_KEY on the server.");
  }
  if (ttsEnv?.toLowerCase() === "elevenlabs" && !elevenlabsKey) {
    nextSteps.push("EXECUTIVE_VOICE_TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY is missing.");
  }

  return NextResponse.json(
    {
      openaiStt: {
        apiKeyPresent: openaiKey,
        executiveVoiceSttProviderEnv: sttEnv,
        defaultModel: getOpenAiSttModel(),
        selfHostedSttConfigured,
        transcriptionAvailable: openaiKey,
        uiLabel: openaiKey ? "Ready" : "Missing API key",
        message: openaiKey
          ? `OpenAI transcription available (model ${getOpenAiSttModel()}).`
          : "Set OPENAI_API_KEY for OpenAI STT.",
      },
      elevenlabsTts: {
        apiKeyPresent: elevenlabsKey,
        executiveVoiceTtsProviderEnv: ttsEnv,
        ready: elevenlabsKey,
        uiLabel: elevenlabsKey ? "Ready" : "Missing API key",
        message: elevenlabsKey ? "ElevenLabs TTS is configured." : "Set ELEVENLABS_API_KEY for ElevenLabs TTS.",
      },
      executiveVoiceTtsProviderEnv: ttsEnv,
      selfHostedStt: {
        configured: selfHostedSttConfigured,
        enabledFlag: trueish(process.env.SELF_HOSTED_STT_ENABLED),
        baseUrlPresent: Boolean(process.env.SELF_HOSTED_STT_BASE_URL?.trim()),
      },
      nextSteps,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
