/**
 * Executive voice session abstraction — no vendor SDKs; describes session shape for UI + adapters.
 */

import { randomUUID } from "crypto";

export type ExecutiveVoiceProviderId =
  | "placeholder"
  | "browser_stt"
  | "browser_webrtc"
  | "openai_realtime"
  | "elevenlabs";

export type ExecutiveVoiceSessionStatus = "active" | "ended";

export type ExecutiveVoiceInputMode = "placeholder" | "browser_stt" | "browser_webrtc" | "openai_realtime";

export type ExecutiveVoiceOutputMode = "placeholder" | "browser_tts" | "elevenlabs_tts" | "openai_realtime_audio";

export type ExecutiveVoiceClientConfig = {
  locale?: string;
  /** Non-secret adapter hints (e.g. fallback reason). */
  hints?: Record<string, string>;
};

export type ExecutiveVoiceSessionPayload = {
  sessionId: string;
  provider: ExecutiveVoiceProviderId;
  status: ExecutiveVoiceSessionStatus;
  inputMode: ExecutiveVoiceInputMode;
  outputMode: ExecutiveVoiceOutputMode;
  expiresAt: string;
  clientConfig: ExecutiveVoiceClientConfig;
};

const VOICE_SESSION_TTL_MS = 45 * 60 * 1000;

function isOpenAiRealtimeConfigured(): boolean {
  return Boolean(process.env.EXECUTIVE_VOICE_OPENAI_REALTIME_URL?.trim());
}

function isElevenLabsVoiceConfigured(): boolean {
  return Boolean(process.env.EXECUTIVE_VOICE_ELEVENLABS_API_BASE?.trim());
}

/**
 * Picks an effective provider when realtime vendors are not configured (browser STT/TTS fallback).
 */
export function resolveExecutiveVoiceProvider(
  requested: ExecutiveVoiceProviderId | null | undefined,
): ExecutiveVoiceProviderId {
  const r = requested ?? "placeholder";
  if (r === "browser_stt") return "browser_stt";
  if (r === "openai_realtime" && !isOpenAiRealtimeConfigured()) {
    return "browser_stt";
  }
  if (r === "elevenlabs" && !isElevenLabsVoiceConfigured()) {
    return "browser_stt";
  }
  if (r === "browser_webrtc") {
    return "browser_webrtc";
  }
  return r;
}

function modesForProvider(
  effective: ExecutiveVoiceProviderId,
  requested: ExecutiveVoiceProviderId | null | undefined,
): { inputMode: ExecutiveVoiceInputMode; outputMode: ExecutiveVoiceOutputMode; hints?: Record<string, string> } {
  const hints: Record<string, string> = {};
  if (requested === "openai_realtime" && effective === "browser_stt") {
    hints.fallback = "openai_realtime_not_configured";
  }
  if (requested === "elevenlabs" && effective === "browser_stt") {
    hints.fallback = "elevenlabs_not_configured";
  }

  switch (effective) {
    case "placeholder":
      return { inputMode: "placeholder", outputMode: "placeholder", hints };
    case "browser_stt":
      return { inputMode: "browser_stt", outputMode: "browser_tts", hints };
    case "browser_webrtc":
      return { inputMode: "browser_webrtc", outputMode: "browser_tts", hints };
    case "openai_realtime":
      return { inputMode: "openai_realtime", outputMode: "openai_realtime_audio", hints };
    case "elevenlabs":
      return { inputMode: "browser_stt", outputMode: "elevenlabs_tts", hints };
    default:
      return { inputMode: "placeholder", outputMode: "placeholder", hints };
  }
}

export function startExecutiveVoiceSessionPayload(input?: {
  provider?: ExecutiveVoiceProviderId | null;
  locale?: string | null;
  ttlMs?: number;
}): ExecutiveVoiceSessionPayload {
  const requested = (input?.provider ?? "placeholder") as ExecutiveVoiceProviderId;
  const effective = resolveExecutiveVoiceProvider(requested);
  const { inputMode, outputMode, hints } = modesForProvider(effective, requested);
  const locale = input?.locale?.trim() || "en-US";
  const ttl = input?.ttlMs ?? VOICE_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  const clientConfig: ExecutiveVoiceClientConfig = {
    locale,
    hints: {
      requestedProvider: requested,
      ...hints,
    },
  };
  return {
    sessionId: randomUUID(),
    provider: effective,
    status: "active",
    inputMode,
    outputMode,
    expiresAt,
    clientConfig,
  };
}
