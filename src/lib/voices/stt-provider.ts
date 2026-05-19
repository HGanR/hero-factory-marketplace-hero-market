/**
 * Executive voice STT routing — browser Web Speech API, self-hosted HTTP engine, or OpenAI (server clip transcription).
 */

export type ExecutiveSttInputMode = "auto" | "browser_stt" | "self_hosted_stt" | "openai_stt";

export type ExecutiveSttProviderId = "openai" | "self_hosted_stt" | "browser_speech_recognition" | "none";

const TRUEISH = new Set(["1", "true", "yes", "on"]);

export function isSelfHostedSttEnabledFlag(): boolean {
  const raw = process.env.SELF_HOSTED_STT_ENABLED?.trim().toLowerCase();
  return raw ? TRUEISH.has(raw) : false;
}

export function getSelfHostedSttBaseUrl(): string | null {
  const b = process.env.SELF_HOSTED_STT_BASE_URL?.trim().replace(/\/+$/, "");
  return b ? b : null;
}

export function isSelfHostedSttEngineConfigured(): boolean {
  return isSelfHostedSttEnabledFlag() && getSelfHostedSttBaseUrl() != null;
}

export function hasBrowserSpeechRecognitionCtor(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  );
}

export function isFirefoxBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /firefox/i.test(navigator.userAgent) && !/seamonkey/i.test(navigator.userAgent);
}

export function isSelfHostedSttHealthReady(report: {
  configured: boolean;
  reachable: boolean;
  transcribeEndpointKnown: boolean;
}): boolean {
  return report.configured && report.reachable && report.transcribeEndpointKnown;
}

/**
 * Pick client-side STT transport (which path records audio or uses browser SR).
 *
 * @param openaiTranscriptionAvailable — from voice preflight `openaiStt.apiKeyPresent` (server has OPENAI_API_KEY).
 * @param executiveVoiceSttProviderEnv — from preflight `openaiStt.executiveVoiceSttProviderEnv` (EXECUTIVE_VOICE_STT_PROVIDER).
 */
export function resolveExecutiveSttProvider(params: {
  inputMode: ExecutiveSttInputMode;
  selfHostedSttReady: boolean;
  openaiTranscriptionAvailable: boolean;
  executiveVoiceSttProviderEnv: string | null;
  /** Pass `isFirefoxBrowser()` from the client; tests pass `false` explicitly. */
  isFirefox?: boolean;
}): ExecutiveSttProviderId {
  const {
    inputMode,
    selfHostedSttReady,
    openaiTranscriptionAvailable,
    executiveVoiceSttProviderEnv,
    isFirefox = false,
  } = params;
  const envStt = (executiveVoiceSttProviderEnv ?? "").trim().toLowerCase();

  if (inputMode === "openai_stt") {
    return openaiTranscriptionAvailable ? "openai" : "none";
  }

  if (inputMode === "self_hosted_stt") {
    return selfHostedSttReady ? "self_hosted_stt" : "none";
  }

  if (inputMode === "browser_stt") {
    return hasBrowserSpeechRecognitionCtor() ? "browser_speech_recognition" : "none";
  }

  // auto — order: env openai + key → self-hosted ready → browser → Firefox + OpenAI key → none
  if (envStt === "openai" && openaiTranscriptionAvailable) {
    return "openai";
  }
  if (selfHostedSttReady) {
    return "self_hosted_stt";
  }
  if (hasBrowserSpeechRecognitionCtor()) {
    return "browser_speech_recognition";
  }
  if (isFirefox && openaiTranscriptionAvailable) {
    return "openai";
  }
  return "none";
}
