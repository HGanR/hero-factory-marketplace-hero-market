/**
 * Server-side routing for Executive admin voice transcription.
 */

import "server-only";

import { isOpenAiSttTranscriptionConfigured } from "@/lib/voices/openai-stt-client";
import { isSelfHostedSttEngineConfigured } from "@/lib/voices/stt-provider";

export type ExecutiveVoiceTranscribeBackend = "openai" | "self_hosted";

function envSttProvider(): string {
  return (process.env.EXECUTIVE_VOICE_STT_PROVIDER ?? "").trim().toLowerCase();
}

/**
 * Resolve backend when the client does not send a preference (legacy callers).
 * 1. EXECUTIVE_VOICE_STT_PROVIDER=openai + OPENAI_API_KEY → openai
 * 2. Self-hosted STT configured → self_hosted
 * 3. OPENAI_API_KEY only → openai
 */
export function pickExecutiveVoiceTranscribeBackendDefault(): ExecutiveVoiceTranscribeBackend | null {
  const openai = isOpenAiSttTranscriptionConfigured();
  const self = isSelfHostedSttEngineConfigured();
  if (envSttProvider() === "openai" && openai) return "openai";
  if (self) return "self_hosted";
  if (openai) return "openai";
  return null;
}

export type SttPreferenceHint = "openai" | "self_hosted_stt" | "";

/**
 * Apply optional multipart `sttPreference` from an authenticated admin client
 * so UI "OpenAI STT" / "Self-hosted STT" modes match the engine used.
 */
export function pickExecutiveVoiceTranscribeBackendWithHint(
  hint: SttPreferenceHint,
): ExecutiveVoiceTranscribeBackend | null {
  const openai = isOpenAiSttTranscriptionConfigured();
  const self = isSelfHostedSttEngineConfigured();
  if (hint === "openai") {
    return openai ? "openai" : null;
  }
  if (hint === "self_hosted_stt") {
    return self ? "self_hosted" : null;
  }
  return pickExecutiveVoiceTranscribeBackendDefault();
}

export function executiveVoiceSttNotConfiguredMessage(): string {
  const openai = isOpenAiSttTranscriptionConfigured();
  const self = isSelfHostedSttEngineConfigured();
  if (!openai && !self) {
    return "No transcription backend: set OPENAI_API_KEY (and optionally EXECUTIVE_VOICE_STT_PROVIDER=openai) or configure SELF_HOSTED_STT_*.";
  }
  if (envSttProvider() === "openai" && !openai) {
    return "EXECUTIVE_VOICE_STT_PROVIDER=openai but OPENAI_API_KEY is missing.";
  }
  return "Transcription is not available.";
}

export function describeExecutiveTranscribeHintFailure(hint: SttPreferenceHint): string {
  if (hint === "openai") return "OpenAI STT requested but OPENAI_API_KEY is missing.";
  if (hint === "self_hosted_stt") return "Self-hosted STT requested but SELF_HOSTED_STT_* is not configured.";
  return executiveVoiceSttNotConfiguredMessage();
}
