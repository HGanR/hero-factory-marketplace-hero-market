/**
 * Executive agent voice — re-exports session payload builder for legacy imports.
 * Prefer `@/lib/executive-agent/executive-voice-provider` for new code.
 */

import {
  resolveExecutiveVoiceProvider,
  startExecutiveVoiceSessionPayload,
} from "@/lib/executive-agent/executive-voice-provider";

export type { ExecutiveVoiceSessionPayload } from "@/lib/executive-agent/executive-voice-provider";
export { resolveExecutiveVoiceProvider, startExecutiveVoiceSessionPayload };

export type ExecutiveVoiceProviderId =
  | "placeholder"
  | "browser_stt"
  | "browser_webrtc"
  | "openai_realtime"
  | "elevenlabs";

export type ExecutiveVoiceSessionInput = {
  provider?: ExecutiveVoiceProviderId;
  locale?: string;
};

/** Legacy shape returned by older UI — use ExecutiveVoiceSessionPayload + capabilities from /voice/start. */
export type ExecutiveVoiceSessionResult = {
  sessionId: string;
  provider: ExecutiveVoiceProviderId;
  transcript: string | null;
  responseAudioUrl: string | null;
  capabilities: string[];
};

export function createExecutiveVoiceSessionPlaceholder(
  input: ExecutiveVoiceSessionInput = {}
): ExecutiveVoiceSessionResult {
  const p = startExecutiveVoiceSessionPayload({
    provider: input.provider,
    locale: input.locale,
  });
  return {
    sessionId: p.sessionId,
    provider: p.provider,
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
  };
}
