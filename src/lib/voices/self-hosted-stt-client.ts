/**
 * Self-hosted STT HTTP client (server-side).
 *
 * POST {SELF_HOSTED_STT_BASE_URL}/stt/transcribe
 * multipart/form-data: `audio` (file), optional `language`
 * JSON: { transcript, confidence? }
 *
 * Optional: SELF_HOSTED_STT_API_KEY as Authorization: Bearer …
 */

import "server-only";

function baseUrl(): string {
  const b = process.env.SELF_HOSTED_STT_BASE_URL?.trim().replace(/\/+$/, "");
  if (!b) throw new Error("SELF_HOSTED_STT_BASE_URL");
  return b;
}

function authHeaders(): HeadersInit {
  const key = process.env.SELF_HOSTED_STT_API_KEY?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

export type SelfHostedSttTranscribeResult = {
  transcript: string;
  confidence?: number;
};

export async function selfHostedSttTranscribe(input: {
  audio: Buffer;
  filename: string;
  mimeType: string;
  language?: string | null;
}): Promise<SelfHostedSttTranscribeResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.audio)], { type: input.mimeType || "application/octet-stream" });
  form.append("audio", blob, input.filename || "clip.webm");
  if (input.language?.trim()) {
    form.append("language", input.language.trim().slice(0, 32));
  }

  const url = `${baseUrl()}/stt/transcribe`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Self-hosted STT transcribe failed ${res.status}: ${err.slice(0, 800)}`);
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json.transcript !== "string") {
    throw new Error("Self-hosted STT returned invalid JSON (missing transcript)");
  }
  const transcript = json.transcript.trim();
  const confidence = typeof json.confidence === "number" && Number.isFinite(json.confidence) ? json.confidence : undefined;
  return { transcript, confidence };
}
