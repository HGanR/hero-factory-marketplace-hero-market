import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("self-hosted-stt-engine.md", () => {
  it("documents /stt/transcribe and env vars", () => {
    const p = join(__dirname, "../../../docs/voice/self-hosted-stt-engine.md");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("SELF_HOSTED_STT_ENABLED"));
    assert.ok(src.includes("SELF_HOSTED_STT_BASE_URL"));
    assert.ok(src.includes("127.0.0.1:8788"));
    assert.ok(src.includes("/stt/transcribe"));
  });
});

describe("admin self-hosted-stt-health route (source)", () => {
  it("does not expose STT API key env name in source", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/self-hosted-stt-health/route.ts");
    const src = readFileSync(p, "utf8");
    assert.equal(src.includes("SELF_HOSTED_STT_API_KEY"), false);
    assert.ok(src.includes("getSelfHostedSttHealthReport"));
  });
});

describe("getSelfHostedSttHealthReport", () => {
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
    stash("SELF_HOSTED_STT_ENABLED");
    stash("SELF_HOSTED_STT_BASE_URL");
    process.env.SELF_HOSTED_STT_ENABLED = "true";
    delete process.env.SELF_HOSTED_STT_BASE_URL;
    const { getSelfHostedSttHealthReport } = await import("./self-hosted-stt-health.ts");
    const r = await getSelfHostedSttHealthReport();
    assert.equal(r.configured, false);
    assert.equal(r.baseUrlPresent, false);
    assert.equal(r.uiLabel, "Not configured");
    assert.equal(JSON.stringify(r).includes("SECRET_TEST_KEY"), false);
  });

  it("JSON shape never includes api key placeholder when key is set in env", async () => {
    stash("SELF_HOSTED_STT_ENABLED");
    stash("SELF_HOSTED_STT_BASE_URL");
    stash("SELF_HOSTED_STT_API_KEY");
    process.env.SELF_HOSTED_STT_ENABLED = "true";
    delete process.env.SELF_HOSTED_STT_BASE_URL;
    process.env.SELF_HOSTED_STT_API_KEY = "SECRET_TEST_KEY";
    const { getSelfHostedSttHealthReport } = await import("./self-hosted-stt-health.ts");
    const r = await getSelfHostedSttHealthReport();
    const s = JSON.stringify(r);
    assert.equal(s.includes("SECRET_TEST_KEY"), false);
  });
});
