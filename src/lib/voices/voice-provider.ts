import { PRESET_VOICES } from "@/lib/voices/presets";
import { selfHostedCreateVoice, selfHostedTtsSpeak } from "@/lib/voices/self-hosted-tts-client";

/** Stored on `ai_voices.provider` and agent `voiceProvider`. */
export const VOICE_PROVIDER_ELEVENLABS = "elevenlabs";
export const VOICE_PROVIDER_OPENAI = "openai";
export const VOICE_PROVIDER_SELF_HOSTED_TTS = "self_hosted_tts";

export const CUSTOM_CLONE_PROVIDERS = [VOICE_PROVIDER_ELEVENLABS, VOICE_PROVIDER_SELF_HOSTED_TTS] as const;
export type CustomCloneProvider = (typeof CUSTOM_CLONE_PROVIDERS)[number];

export type VoiceEngineStatus = {
  selfHostedTts: { enabledFlag: boolean; configured: boolean };
  elevenlabs: { configured: boolean };
  openaiPresets: { configured: boolean };
};

const TRUEISH = new Set(["1", "true", "yes", "on"]);

export function isSelfHostedTtsEnabledFlag(): boolean {
  const raw = process.env.SELF_HOSTED_TTS_ENABLED?.trim().toLowerCase();
  return raw ? TRUEISH.has(raw) : false;
}

export function getSelfHostedTtsBaseUrl(): string | null {
  const b = process.env.SELF_HOSTED_TTS_BASE_URL?.trim().replace(/\/+$/, "");
  return b ? b : null;
}

export function isSelfHostedVoiceEngineConfigured(): boolean {
  return isSelfHostedTtsEnabledFlag() && getSelfHostedTtsBaseUrl() != null;
}

export function selfHostedVoiceEngineNotConfiguredMessage(): string {
  return "Self-hosted voice engine not configured.";
}

export function getVoiceEnginesStatus(): VoiceEngineStatus {
  return {
    selfHostedTts: {
      enabledFlag: isSelfHostedTtsEnabledFlag(),
      configured: isSelfHostedVoiceEngineConfigured(),
    },
    elevenlabs: { configured: Boolean(process.env.ELEVENLABS_API_KEY?.trim()) },
    openaiPresets: { configured: Boolean(process.env.OPENAI_API_KEY?.trim()) },
  };
}

export class VoiceProviderHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "VoiceProviderHttpError";
    this.status = status;
  }
}

/** Strip obvious secret patterns from upstream error bodies for safe client-facing messages. */
function redactSecretPatterns(s: string): string {
  return s
    .replace(/sk-[a-zA-Z0-9-_]{12,}/gi, "[redacted]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/xi-api-key["']:\s*["'][^"']+["']/gi, 'xi-api-key":"[redacted]"');
}

function upstreamTtsErrorMessage(service: "OpenAI" | "ElevenLabs", status: number, body: string): string {
  const t = redactSecretPatterns(body).replace(/\s+/g, " ").trim().slice(0, 200);
  if (t) return `${service} TTS failed (HTTP ${status}): ${t}`;
  return `${service} TTS failed (HTTP ${status}).`;
}

export type VoiceClipFile = { filename: string; mime: string; bytes: Buffer };

/**
 * Create a cloned/custom voice from audio clips (ElevenLabs or self-hosted engine).
 * Does not import ElevenLabs when `provider` is `self_hosted_tts`.
 */
export async function createClonedVoiceFromClips(input: {
  provider: CustomCloneProvider;
  displayName: string;
  files: VoiceClipFile[];
}): Promise<{ providerVoiceId: string; status: "active" | "pending" }> {
  if (input.provider === VOICE_PROVIDER_SELF_HOSTED_TTS) {
    if (!isSelfHostedVoiceEngineConfigured()) {
      throw new VoiceProviderHttpError(503, selfHostedVoiceEngineNotConfiguredMessage());
    }
    const { providerVoiceId } = await selfHostedCreateVoice(input.displayName, input.files);
    return { providerVoiceId, status: "active" };
  }
  if (input.provider === VOICE_PROVIDER_ELEVENLABS) {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      throw new VoiceProviderHttpError(503, "Voice cloning not configured. Set ELEVENLABS_API_KEY.");
    }
    const { createElevenLabsVoice } = await import("@/lib/voices/elevenlabs");
    const out = await createElevenLabsVoice({
      name: input.displayName,
      files: input.files,
      removeBackgroundNoise: true,
    });
    return { providerVoiceId: out.providerVoiceId, status: out.status };
  }
  throw new VoiceProviderHttpError(400, "Unsupported clone provider.");
}

export type PreviewTtsProvider = typeof VOICE_PROVIDER_OPENAI | typeof VOICE_PROVIDER_ELEVENLABS | typeof VOICE_PROVIDER_SELF_HOSTED_TTS;

/**
 * Server-side TTS for preview / executive speak (returns raw audio).
 */
export async function synthesizePreviewAudio(input: {
  provider: PreviewTtsProvider;
  voiceId: string;
  text: string;
}): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const text = input.text.slice(0, 8000);
  if (input.provider === VOICE_PROVIDER_SELF_HOSTED_TTS) {
    if (!isSelfHostedVoiceEngineConfigured()) {
      throw new VoiceProviderHttpError(503, selfHostedVoiceEngineNotConfiguredMessage());
    }
    return selfHostedTtsSpeak(input.voiceId, text);
  }
  if (input.provider === VOICE_PROVIDER_ELEVENLABS) {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      throw new VoiceProviderHttpError(503, "Set ELEVENLABS_API_KEY for custom voice preview.");
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 200),
        model_id: "eleven_monolingual_v1",
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("ElevenLabs TTS error:", res.status, err);
      throw new VoiceProviderHttpError(502, upstreamTtsErrorMessage("ElevenLabs", res.status, err));
    }
    const buffer = await res.arrayBuffer();
    return { buffer, contentType: "audio/mpeg" };
  }
  let providerVoiceId = input.voiceId;
  const preset = PRESET_VOICES.find((v) => v.id === input.voiceId || v.providerVoiceId === input.voiceId);
  providerVoiceId = preset?.providerVoiceId ?? input.voiceId;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new VoiceProviderHttpError(503, "Set OPENAI_API_KEY for preset preview.");
  }
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: providerVoiceId,
      input: text.slice(0, 200),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn("OpenAI TTS error:", res.status, err);
    throw new VoiceProviderHttpError(502, upstreamTtsErrorMessage("OpenAI", res.status, err));
  }
  const buffer = await res.arrayBuffer();
  return { buffer, contentType: "audio/mpeg" };
}
