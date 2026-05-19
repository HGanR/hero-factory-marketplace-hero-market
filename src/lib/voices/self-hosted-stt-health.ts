import { getSelfHostedSttBaseUrl, isSelfHostedSttEnabledFlag, isSelfHostedSttEngineConfigured } from "@/lib/voices/stt-provider";

export { isSelfHostedSttHealthReady } from "@/lib/voices/stt-provider";

export type SelfHostedSttHealthReport = {
  configured: boolean;
  enabled: boolean;
  baseUrlPresent: boolean;
  reachable: boolean;
  transcribeEndpointKnown: boolean;
  message: string;
  uiLabel: "Not configured" | "Unreachable" | "Configured" | "Ready";
};

function authHeaders(): HeadersInit {
  const key = process.env.SELF_HOSTED_STT_API_KEY?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Probes self-hosted STT. Never exposes API keys in the return value.
 */
export async function getSelfHostedSttHealthReport(): Promise<SelfHostedSttHealthReport> {
  const enabled = isSelfHostedSttEnabledFlag();
  const baseUrlPresent = getSelfHostedSttBaseUrl() != null;
  const configured = isSelfHostedSttEngineConfigured();

  if (!configured) {
    const message = !enabled
      ? "SELF_HOSTED_STT_ENABLED is not set to a true value."
      : "SELF_HOSTED_STT_BASE_URL is missing.";
    return {
      configured: false,
      enabled,
      baseUrlPresent,
      reachable: false,
      transcribeEndpointKnown: false,
      message,
      uiLabel: "Not configured",
    };
  }

  const base = getSelfHostedSttBaseUrl()!;
  const rootUrl = `${base}/`;

  let reachable = false;
  try {
    const r = await fetch(rootUrl, { method: "GET", signal: withTimeout(3200), headers: authHeaders() });
    reachable = r.ok;
  } catch {
    reachable = false;
  }

  let transcribeEndpointKnown = false;
  if (reachable) {
    try {
      const form = new FormData();
      const wav = minimalWavPcm();
      form.append("audio", new Blob([Buffer.from(wav)], { type: "audio/wav" }), "health.wav");
      form.append("language", "en");
      const tr = `${base}/stt/transcribe`;
      const r = await fetch(tr, { method: "POST", body: form, signal: withTimeout(8000), headers: authHeaders() });
      transcribeEndpointKnown = r.ok;
    } catch {
      transcribeEndpointKnown = false;
    }
  }

  let message: string;
  let uiLabel: SelfHostedSttHealthReport["uiLabel"];

  if (!reachable) {
    message = "Could not reach the self-hosted STT engine at SELF_HOSTED_STT_BASE_URL.";
    uiLabel = "Unreachable";
  } else if (!transcribeEndpointKnown) {
    message =
      "Host responded but POST /stt/transcribe did not succeed within the health timeout (check routes and auth).";
    uiLabel = "Configured";
  } else {
    message = "Self-hosted STT engine is reachable and /stt/transcribe responded.";
    uiLabel = "Ready";
  }

  return {
    configured: true,
    enabled,
    baseUrlPresent,
    reachable,
    transcribeEndpointKnown,
    message,
    uiLabel,
  };
}

/** Tiny valid WAV for health probe (silence). */
function minimalWavPcm(): Uint8Array {
  const sampleRate = 8000;
  const numSamples = 80;
  const bitsPerSample = 16;
  const numChannels = 1;
  const dataSize = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true);
  v.setUint16(32, (numChannels * bitsPerSample) / 8, true);
  v.setUint16(34, bitsPerSample, true);
  w(36, "data");
  v.setUint32(40, dataSize, true);
  return new Uint8Array(buf);
}
