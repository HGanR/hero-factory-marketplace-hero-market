/**
 * Self-hosted voice engine HTTP client.
 *
 * Expected service (relative to `SELF_HOSTED_TTS_BASE_URL`, no trailing slash):
 * - `POST /voices/create` — multipart `name` + repeated `files`; JSON response `{ voiceId }` | `{ voice_id }` | `{ id }`.
 * - `POST /tts/speak` — JSON `{ voiceId, text }` (also sends `voice_id`); returns raw audio (`audio/mpeg` or other).
 * - Optional: `GET /voices/:id` — not used by this app yet.
 *
 * Auth: optional `SELF_HOSTED_TTS_API_KEY` as `Authorization: Bearer …`.
 */

export type SelfHostedTtsFile = { filename: string; mime: string; bytes: Buffer };

function baseUrl(): string {
  const b = process.env.SELF_HOSTED_TTS_BASE_URL?.trim().replace(/\/+$/, "");
  if (!b) throw new Error("SELF_HOSTED_TTS_BASE_URL");
  return b;
}

function authHeaders(): HeadersInit {
  const key = process.env.SELF_HOSTED_TTS_API_KEY?.trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

function parseVoiceIdFromCreateResponse(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  const id =
    (typeof o.voiceId === "string" && o.voiceId) ||
    (typeof o.voice_id === "string" && o.voice_id) ||
    (typeof o.id === "string" && o.id) ||
    "";
  return id.trim();
}

/**
 * POST {BASE}/voices/create — multipart: `name`, repeated `files` (or `file`).
 * Expect JSON: `{ voiceId }` | `{ voice_id }` | `{ id }`.
 */
export async function selfHostedCreateVoice(displayName: string, files: SelfHostedTtsFile[]): Promise<{ providerVoiceId: string }> {
  const form = new FormData();
  form.append("name", displayName.slice(0, 200));
  for (const f of files) {
    const blob = new Blob([new Uint8Array(f.bytes)], { type: f.mime || "application/octet-stream" });
    form.append("files", blob, f.filename || "clip.mp3");
  }
  const url = `${baseUrl()}/voices/create`;
  const res = await fetch(url, { method: "POST", headers: authHeaders(), body: form });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Self-hosted voices/create failed ${res.status}: ${err.slice(0, 500)}`);
  }
  const json = (await res.json().catch(() => null)) as unknown;
  const providerVoiceId = parseVoiceIdFromCreateResponse(json);
  if (!providerVoiceId) {
    throw new Error("Self-hosted voices/create returned no voice id");
  }
  return { providerVoiceId };
}

/**
 * POST {BASE}/tts/speak — JSON `{ voiceId, text }` (also sends `voice_id` mirror).
 * Returns raw audio bytes and optional Content-Type.
 */
export async function selfHostedTtsSpeak(voiceId: string, text: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const url = `${baseUrl()}/tts/speak`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      voiceId,
      voice_id: voiceId,
      text: text.slice(0, 8000),
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Self-hosted tts/speak failed ${res.status}: ${err.slice(0, 500)}`);
  }
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("Content-Type")?.split(";")[0]?.trim() || "audio/mpeg";
  return { buffer, contentType };
}
