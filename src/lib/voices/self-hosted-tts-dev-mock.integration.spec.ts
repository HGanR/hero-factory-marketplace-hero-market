import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getFreePort(): Promise<number> {
  const s = net.createServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const a = s.address();
  const p = typeof a === "object" && a && "port" in a ? a.port : 8787;
  await new Promise<void>((res) => s.close(() => res()));
  return p;
}

async function waitForDevMock(base: string) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/`, { signal: AbortSignal.timeout(600) });
      if (!r.ok) continue;
      const j = (await r.json()) as { ok?: boolean; service?: string };
      if (j.ok === true && j.service === "self-hosted-tts-dev-server") return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("self-hosted-tts-dev-server did not become ready in time");
}

describe("self-hosted-tts-dev-server (integration)", () => {
  let child: ChildProcess | null = null;
  let base = "";
  const envSnapshot: Record<string, string | undefined> = {};

  before(async () => {
    for (const k of ["SELF_HOSTED_TTS_ENABLED", "SELF_HOSTED_TTS_BASE_URL", "SELF_HOSTED_TTS_API_KEY"] as const) {
      envSnapshot[k] = process.env[k];
    }
    const port = await getFreePort();
    base = `http://127.0.0.1:${port}`;
    process.env.SELF_HOSTED_TTS_ENABLED = "true";
    process.env.SELF_HOSTED_TTS_BASE_URL = base;
    delete process.env.SELF_HOSTED_TTS_API_KEY;

    const serverPath = join(__dirname, "../../../tools/self-hosted-tts-dev-server/server.mjs");
    child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: String(port), BIND_HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await waitForDevMock(base);
    } catch (e) {
      if (child?.pid) child.kill("SIGTERM");
      child = null;
      throw e;
    }
  });

  after(() => {
    if (child?.pid) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
    child = null;
    for (const k of Object.keys(envSnapshot)) {
      const v = envSnapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it(
    "health report is Ready, voice create succeeds, tts/speak returns audio/wav",
    { timeout: 60_000 },
    async () => {
      const { getSelfHostedTtsHealthReport } = await import("./self-hosted-tts-health.ts");
      const health = await getSelfHostedTtsHealthReport();
      assert.equal(health.uiLabel, "Ready");
      assert.equal(health.configured, true);
      assert.equal(health.reachable, true);
      assert.equal(health.createEndpointKnown, true);
      assert.equal(health.speakEndpointKnown, true);

      const { createClonedVoiceFromClips, VOICE_PROVIDER_SELF_HOSTED_TTS, synthesizePreviewAudio } = await import(
        "./voice-provider.ts"
      );
      const out = await createClonedVoiceFromClips({
        provider: VOICE_PROVIDER_SELF_HOSTED_TTS,
        displayName: "integration-test",
        files: [{ filename: "clip.wav", mime: "audio/wav", bytes: Buffer.alloc(16, 1) }],
      });
      assert.match(out.providerVoiceId, /^dev_voice_\d+$/);

      const tts = await synthesizePreviewAudio({
        provider: VOICE_PROVIDER_SELF_HOSTED_TTS,
        voiceId: out.providerVoiceId,
        text: "Hello from integration test.",
      });
      assert.ok(tts.buffer.byteLength > 100);
      assert.ok(
        tts.contentType.includes("wav") || tts.contentType.includes("wave"),
        `expected wav content-type, got ${tts.contentType}`,
      );
    },
  );
});
