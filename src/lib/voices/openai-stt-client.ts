/**
 * OpenAI speech-to-text (server-side only). Uses OPENAI_API_KEY.
 *
 * Default model: gpt-4o-mini-transcribe. Override with OPENAI_STT_MODEL (e.g. whisper-1).
 */

import "server-only";

const DEFAULT_MODEL = "gpt-4o-mini-transcribe";

export type OpenAiSttTranscribeResult = {
  transcript: string;
  confidence: null;
  provider: "openai";
};

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) throw new Error("OPENAI_API_KEY not set");
  return k;
}

export function getOpenAiSttModel(): string {
  const m = process.env.OPENAI_STT_MODEL?.trim();
  return m || DEFAULT_MODEL;
}

export function isOpenAiSttTranscriptionConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * POST https://api.openai.com/v1/audio/transcriptions (multipart).
 */
export async function openaiSttTranscribe(input: {
  audio: Buffer;
  filename: string;
  mimeType: string;
  language?: string | null;
}): Promise<OpenAiSttTranscribeResult> {
  const model = getOpenAiSttModel();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.audio)], { type: input.mimeType || "application/octet-stream" });
  form.append("file", blob, input.filename || "audio.webm");
  form.append("model", model);
  form.append("response_format", "json");
  if (input.language?.trim()) {
    form.append("language", input.language.trim().slice(0, 32));
  }

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI STT failed ${res.status}: ${err.slice(0, 800)}`);
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const text =
    typeof json?.text === "string"
      ? json.text.trim()
      : typeof json?.transcript === "string"
        ? (json.transcript as string).trim()
        : "";
  if (!text) {
    throw new Error("OpenAI STT returned empty transcript");
  }
  return { transcript: text, confidence: null, provider: "openai" };
}
