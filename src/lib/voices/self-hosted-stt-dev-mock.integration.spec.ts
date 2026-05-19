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
  const p = typeof a === "object" && a && "port" in a ? a.port : 8788;
  await new Promise<void>((res) => s.close(() => res()));
  return p;
}

async function waitForSttMock(base: string) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/`, { signal: AbortSignal.timeout(600) });
      if (!r.ok) continue;
      const j = (await r.json()) as { ok?: boolean; service?: string };
      if (j.ok === true && j.service === "self-hosted-stt-dev-server") return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("self-hosted-stt-dev-server did not become ready in time");
}

describe("self-hosted-stt-dev-server (integration)", () => {
  let child: ChildProcess | null = null;
  let base = "";
  const envSnapshot: Record<string, string | undefined> = {};

  before(async () => {
    for (const k of ["SELF_HOSTED_STT_ENABLED", "SELF_HOSTED_STT_BASE_URL", "SELF_HOSTED_STT_API_KEY"] as const) {
      envSnapshot[k] = process.env[k];
    }
    const port = await getFreePort();
    base = `http://127.0.0.1:${port}`;
    process.env.SELF_HOSTED_STT_ENABLED = "true";
    process.env.SELF_HOSTED_STT_BASE_URL = base;
    delete process.env.SELF_HOSTED_STT_API_KEY;

    const serverPath = join(__dirname, "../../../tools/self-hosted-stt-dev-server/server.mjs");
    child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT: String(port), BIND_HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await waitForSttMock(base);
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
    "mock POST /stt/transcribe returns Hello Skipper",
    { timeout: 60_000 },
    async () => {
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" }), "x.webm");
      const r = await fetch(`${base}/stt/transcribe`, { method: "POST", body: form });
      assert.ok(r.ok);
      const j = (await r.json()) as { transcript?: string; confidence?: number };
      assert.equal(j.transcript, "Hello Skipper");
      assert.equal(j.confidence, 1);
    },
  );

  it(
    "health report reaches Ready against mock",
    { timeout: 60_000 },
    async () => {
      const { getSelfHostedSttHealthReport } = await import("./self-hosted-stt-health.ts");
      const health = await getSelfHostedSttHealthReport();
      assert.equal(health.uiLabel, "Ready");
      assert.equal(health.configured, true);
      assert.equal(health.reachable, true);
      assert.equal(health.transcribeEndpointKnown, true);
    },
  );
});
