import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("voice-provider source invariants", () => {
  it("POST /api/app/voices uses createClonedVoiceFromClips (no direct createElevenLabsVoice import)", () => {
    const p = join(__dirname, "../../app/api/app/voices/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("createClonedVoiceFromClips"));
    assert.equal(src.includes("createElevenLabsVoice"), false);
  });

  it("preview route handles self_hosted_tts via synthesizePreviewAudio", () => {
    const p = join(__dirname, "../../app/api/app/voices/preview/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("VOICE_PROVIDER_SELF_HOSTED_TTS"));
    assert.ok(src.includes("synthesizePreviewAudio"));
  });

  it("voice-provider uses dynamic import for ElevenLabs only in elevenlabs branch", () => {
    const p = join(__dirname, "voice-provider.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes('await import("@/lib/voices/elevenlabs")'));
    assert.equal(src.indexOf('from "@/lib/voices/elevenlabs"'), -1);
  });

  it("executive speak route uses synthesizePreviewAudio for agent TTS", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/speak/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("synthesizePreviewAudio"));
    assert.ok(src.includes("VOICE_PROVIDER_SELF_HOSTED_TTS"));
  });
});

describe("createClonedVoiceFromClips (runtime)", () => {
  const snapshot: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of Object.keys(snapshot)) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    Object.keys(snapshot).forEach((k) => delete snapshot[k]);
  });

  function stash(key: string) {
    if (!(key in snapshot)) snapshot[key] = process.env[key];
  }

  it("self-hosted without BASE_URL returns VoiceProviderHttpError 503", async () => {
    stash("SELF_HOSTED_TTS_ENABLED");
    stash("SELF_HOSTED_TTS_BASE_URL");
    process.env.SELF_HOSTED_TTS_ENABLED = "true";
    delete process.env.SELF_HOSTED_TTS_BASE_URL;
    const mod = await import("./voice-provider.ts");
    await assert.rejects(
      () =>
        mod.createClonedVoiceFromClips({
          provider: mod.VOICE_PROVIDER_SELF_HOSTED_TTS,
          displayName: "t",
          files: [{ filename: "c.wav", mime: "audio/wav", bytes: Buffer.alloc(4) }],
        }),
      (e: unknown) => e instanceof mod.VoiceProviderHttpError && e.status === 503 && String(e.message).includes("Self-hosted"),
    );
  });

  it("self-hosted create calls engine /voices/create only (mock fetch)", async () => {
    stash("SELF_HOSTED_TTS_ENABLED");
    stash("SELF_HOSTED_TTS_BASE_URL");
    process.env.SELF_HOSTED_TTS_ENABLED = "true";
    process.env.SELF_HOSTED_TTS_BASE_URL = "http://127.0.0.1:9";
    const urls: string[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ voiceId: "local-voice-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const mod = await import("./voice-provider.ts");
      const out = await mod.createClonedVoiceFromClips({
        provider: mod.VOICE_PROVIDER_SELF_HOSTED_TTS,
        displayName: "t",
        files: [{ filename: "c.wav", mime: "audio/wav", bytes: Buffer.alloc(4) }],
      });
      assert.equal(out.providerVoiceId, "local-voice-1");
      assert.ok(urls.some((u) => u.includes("/voices/create")));
      assert.equal(urls.some((u) => u.includes("elevenlabs.io")), false);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("synthesizePreviewAudio self_hosted calls /tts/speak only (mock fetch)", async () => {
    stash("SELF_HOSTED_TTS_ENABLED");
    stash("SELF_HOSTED_TTS_BASE_URL");
    process.env.SELF_HOSTED_TTS_ENABLED = "true";
    process.env.SELF_HOSTED_TTS_BASE_URL = "http://127.0.0.1:9";
    const urls: string[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      const u = String(input);
      if (u.includes("/tts/speak")) {
        assert.ok(init?.body && String(init.body).includes("local-voice-1"));
        return new Response(new Uint8Array([0, 0]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    try {
      const mod = await import("./voice-provider.ts");
      const { buffer } = await mod.synthesizePreviewAudio({
        provider: mod.VOICE_PROVIDER_SELF_HOSTED_TTS,
        voiceId: "local-voice-1",
        text: "hi",
      });
      assert.ok(buffer.byteLength >= 0);
      assert.ok(urls.some((u) => u.includes("/tts/speak")));
      assert.equal(urls.some((u) => u.includes("elevenlabs.io")), false);
      assert.equal(urls.some((u) => u.includes("openai.com")), false);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
