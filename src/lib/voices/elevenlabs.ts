/**
 * ElevenLabs voice cloning integration.
 * Requires ELEVENLABS_API_KEY.
 */

export interface CreateVoiceInput {
  name: string;
  files: { filename: string; mime: string; bytes: Buffer }[];
  description?: string;
  removeBackgroundNoise?: boolean;
}

export interface CreateVoiceOutput {
  providerVoiceId: string;
  status: "active" | "pending";
  requiresVerification?: boolean;
}

export async function createElevenLabsVoice(input: CreateVoiceInput): Promise<CreateVoiceOutput> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const formData = new FormData();
  formData.append("name", input.name);
  if (input.description) formData.append("description", input.description);
  formData.append("remove_background_noise", String(input.removeBackgroundNoise ?? false));

  for (const f of input.files) {
    const blob = new Blob([new Uint8Array(f.bytes)], { type: f.mime });
    formData.append("files", blob, f.filename || "audio.mp3");
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { voice_id?: string; requires_verification?: boolean };
  return {
    providerVoiceId: data.voice_id ?? "",
    status: data.requires_verification ? "pending" : "active",
    requiresVerification: data.requires_verification,
  };
}
