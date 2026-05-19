import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("voice preflight route (source)", () => {
  it("checks OpenAI and ElevenLabs env presence without exposing secrets", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/preflight/route.ts");
    const s = readFileSync(p, "utf8");
    assert.ok(s.includes("OPENAI_API_KEY"));
    assert.ok(s.includes("ELEVENLABS_API_KEY"));
    assert.ok(s.includes("nextSteps"));
    assert.equal(/sk-[a-zA-Z0-9]{10,}/.test(s), false);
  });
});

describe("voice speak route ElevenLabs policy (source)", () => {
  it("enforces EXECUTIVE_VOICE_TTS_PROVIDER=elevenlabs or openai against SKIPPER voice", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/speak/route.ts");
    const s = readFileSync(p, "utf8");
    assert.ok(s.includes("EXECUTIVE_VOICE_TTS_PROVIDER"));
    assert.ok(s.includes("TTS_POLICY_MISMATCH"));
    assert.ok(s.includes("synthesizePreviewAudio"));
    assert.ok(s.includes("VOICE_PROVIDER_OPENAI"));
  });
});

describe("skipper output voice (source)", () => {
  it("treats openai as supported Executive TTS provider", () => {
    const p = join(__dirname, "../voices/executive-skipper-output-voice.ts");
    const s = readFileSync(p, "utf8");
    assert.ok(s.includes("VOICE_PROVIDER_OPENAI"));
    assert.ok(s.includes("VOICE_PROVIDER_ELEVENLABS"));
  });
});

describe("voice/turn route orchestrator (source)", () => {
  it("uses runExecutiveOrchestrator and does not call approval executor", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("runExecutiveOrchestrator"));
    assert.equal(src.includes("executeExecutiveApprovedAction"), false);
  });
});
