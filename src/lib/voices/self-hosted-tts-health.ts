import { getSelfHostedTtsBaseUrl, isSelfHostedTtsEnabledFlag, isSelfHostedVoiceEngineConfigured } from "@/lib/voices/voice-provider";

export type SelfHostedTtsHealthReport = {
  configured: boolean;
  enabled: boolean;
  baseUrlPresent: boolean;
  reachable: boolean;
  createEndpointKnown: boolean;
  speakEndpointKnown: boolean;
  message: string;
  /** UI label: Not configured | Unreachable | Configured | Ready */
  uiLabel: "Not configured" | "Unreachable" | "Configured" | "Ready";
};

function authHeaders(): HeadersInit {
  const key = process.env.SELF_HOSTED_TTS_API_KEY?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function gotHttpResponse(url: string, init: RequestInit): Promise<boolean> {
  try {
    await fetch(url, {
      ...init,
      signal: withTimeout(3200),
      headers: { ...authHeaders(), ...(init.headers as Record<string, string>) },
    });
    return true;
  } catch {
    return false;
  }
}

export function isSelfHostedTtsHealthReady(report: SelfHostedTtsHealthReport): boolean {
  return report.configured && report.reachable && report.createEndpointKnown && report.speakEndpointKnown;
}

/**
 * Probes the self-hosted engine (short timeouts). Never exposes secrets in the return value.
 */
export async function getSelfHostedTtsHealthReport(): Promise<SelfHostedTtsHealthReport> {
  const enabled = isSelfHostedTtsEnabledFlag();
  const baseUrlPresent = getSelfHostedTtsBaseUrl() != null;
  const configured = isSelfHostedVoiceEngineConfigured();

  if (!configured) {
    const message = !enabled
      ? "SELF_HOSTED_TTS_ENABLED is not set to a true value."
      : "SELF_HOSTED_TTS_BASE_URL is missing.";
    return {
      configured: false,
      enabled,
      baseUrlPresent,
      reachable: false,
      createEndpointKnown: false,
      speakEndpointKnown: false,
      message,
      uiLabel: "Not configured",
    };
  }

  const base = getSelfHostedTtsBaseUrl()!;
  const rootUrl = `${base}/`;

  const reachable = await gotHttpResponse(rootUrl, { method: "GET" });

  let createEndpointKnown = false;
  let speakEndpointKnown = false;

  if (reachable) {
    const form = new FormData();
    form.append("name", "HeroMarketHealthProbe");
    const createUrl = `${base}/voices/create`;
    createEndpointKnown = await gotHttpResponse(createUrl, { method: "POST", body: form });

    const speakUrl = `${base}/tts/speak`;
    speakEndpointKnown = await gotHttpResponse(speakUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: "_", voice_id: "_", text: " " }),
    });
  }

  let message: string;
  let uiLabel: SelfHostedTtsHealthReport["uiLabel"];

  if (!reachable) {
    message = "Could not reach the self-hosted engine at SELF_HOSTED_TTS_BASE_URL.";
    uiLabel = "Unreachable";
  } else if (!createEndpointKnown || !speakEndpointKnown) {
    message =
      "Host responded but POST /voices/create or POST /tts/speak did not complete within the health timeout (check routes and auth).";
    uiLabel = "Configured";
  } else {
    message = "Self-hosted voice engine is reachable and required endpoints responded.";
    uiLabel = "Ready";
  }

  return {
    configured: true,
    enabled,
    baseUrlPresent,
    reachable,
    createEndpointKnown,
    speakEndpointKnown,
    message,
    uiLabel,
  };
}
