import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("self-hosted-tts-engine.md", () => {
  it("documents /voices/create and /tts/speak", () => {
    const p = join(__dirname, "../../../docs/voice/self-hosted-tts-engine.md");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("/voices/create"));
    assert.ok(src.includes("/tts/speak"));
  });
});

describe("admin self-hosted-health route (source)", () => {
  it("does not put API key env name into JSON response keys", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/self-hosted-health/route.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("SELF_HOSTED_TTS_API_KEY"), false);
    assert.ok(src.includes("configured"));
    assert.ok(src.includes("uiLabel"));
  });
});

describe("getSelfHostedTtsHealthReport", () => {
  const snapshot: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of Object.keys(snapshot)) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    for (const k of Object.keys(snapshot)) delete snapshot[k];
  });

  function stash(k: string) {
    if (!(k in snapshot)) snapshot[k] = process.env[k];
  }

  it("reports configured false when BASE_URL missing", async () => {
    stash("SELF_HOSTED_TTS_ENABLED");
    stash("SELF_HOSTED_TTS_BASE_URL");
    process.env.SELF_HOSTED_TTS_ENABLED = "true";
    delete process.env.SELF_HOSTED_TTS_BASE_URL;
    const { getSelfHostedTtsHealthReport } = await import("./self-hosted-tts-health.ts");
    const r = await getSelfHostedTtsHealthReport();
    assert.equal(r.configured, false);
    assert.equal(r.uiLabel, "Not configured");
    assert.equal(JSON.stringify(r).includes("SECRET_TEST_KEY"), false);
  });

  it("JSON shape never includes api key placeholder when key is set in env", async () => {
    stash("SELF_HOSTED_TTS_ENABLED");
    stash("SELF_HOSTED_TTS_BASE_URL");
    stash("SELF_HOSTED_TTS_API_KEY");
    process.env.SELF_HOSTED_TTS_ENABLED = "true";
    delete process.env.SELF_HOSTED_TTS_BASE_URL;
    process.env.SELF_HOSTED_TTS_API_KEY = "SECRET_TEST_KEY";
    const { getSelfHostedTtsHealthReport } = await import("./self-hosted-tts-health.ts");
    const r = await getSelfHostedTtsHealthReport();
    const s = JSON.stringify(r);
    assert.equal(s.includes("SECRET_TEST_KEY"), false);
  });
});

describe("Executive voice turn + speak fallback (source)", () => {
  it("sets transcript with Executive answer before invoking speakExecutiveAnswer", () => {
    const p = join(__dirname, "../../components/executive-admin/ExecutiveAgentDashboard.tsx");
    const src = readFileSync(p, "utf8");
    const idxExec = src.indexOf("Executive: ${answer.slice");
    const idxSpeak = src.indexOf("await speakExecutiveAnswer(answer");
    assert.ok(idxExec > 0 && idxSpeak > idxExec);
  });

  it("forces browser TTS when self_hosted health is not ready", () => {
    const p = join(__dirname, "../../components/executive-admin/ExecutiveAgentDashboard.tsx");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes('ev?.voiceProvider === "self_hosted_tts"'));
    assert.ok(src.includes("executiveSelfHostedVoiceReady"));
    assert.ok(src.includes("Self-hosted voice engine unavailable. Falling back to browser voice."));
  });
});
