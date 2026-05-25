import assert from "node:assert/strict";
import crypto from "crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  assertContent360SmokeTestMode,
  evaluateContent360Env,
  gateContent360Scheduling,
  isContent360FeatureEnabled,
} from "@/lib/social/providers/content360/content360-env";
import { buildContent360ReadinessForClient } from "@/lib/revenue-os/content360-readiness-server";
import { verifyContent360WebhookSignature } from "@/lib/revenue-os/content360-webhook-verify";

describe("Content360 Phase 5 env", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.CONTENT360_ENABLED;
    delete process.env.CONTENT360_BASE_URL;
    delete process.env.CONTENT360_API_BASE;
    delete process.env.CONTENT360_WEBHOOK_SECRET;
    delete process.env.CONTENT360_REQUEST_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env.CONTENT360_ENABLED = prev.CONTENT360_ENABLED;
    process.env.CONTENT360_BASE_URL = prev.CONTENT360_BASE_URL;
    process.env.CONTENT360_API_BASE = prev.CONTENT360_API_BASE;
    process.env.CONTENT360_WEBHOOK_SECRET = prev.CONTENT360_WEBHOOK_SECRET;
    process.env.CONTENT360_REQUEST_TIMEOUT_MS = prev.CONTENT360_REQUEST_TIMEOUT_MS;
  });

  it("feature flag defaults off", () => {
    assert.equal(isContent360FeatureEnabled(), false);
  });

  it("gateContent360Scheduling blocks when disabled", () => {
    const g = gateContent360Scheduling();
    assert.equal(g.ok, false);
    if (!g.ok) {
      assert.equal(g.code, "CONTENT360_DISABLED");
      assert.equal(g.status, 403);
    }
  });

  it("gateContent360Scheduling allows when CONTENT360_ENABLED=true", () => {
    process.env.CONTENT360_ENABLED = "true";
    const g = gateContent360Scheduling();
    assert.equal(g.ok, true);
  });

  it("evaluateContent360Env lists missing API base when enabled without base", () => {
    process.env.CONTENT360_ENABLED = "true";
    const e = evaluateContent360Env();
    assert.equal(e.featureEnabled, true);
    assert.equal(e.providerConfigured, false);
    assert.ok(
      e.missing.some((m) => m.includes("CONTENT360_BASE_URL") || m.includes("CONTENT360_API_BASE")),
    );
  });

  it("assertContent360SmokeTestMode throws without CONTENT360_SMOKE_TEST=1", () => {
    delete process.env.CONTENT360_SMOKE_TEST;
    assert.throws(() => assertContent360SmokeTestMode(), /CONTENT360_SMOKE_TEST/);
  });

  it("assertContent360SmokeTestMode passes when set", () => {
    process.env.CONTENT360_SMOKE_TEST = "1";
    assert.doesNotThrow(() => assertContent360SmokeTestMode());
  });
});

describe("Content360 readiness builder", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.CONTENT360_ENABLED = prev.CONTENT360_ENABLED;
    process.env.CONTENT360_API_BASE = prev.CONTENT360_API_BASE;
  });

  it("readiness without connection lists CONTENT360_CONNECTION when enabled", async () => {
    process.env.CONTENT360_ENABLED = "true";
    process.env.CONTENT360_API_BASE = "https://api.example.test";
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy() {
                    return {
                      limit: async () => [],
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
    const r = await buildContent360ReadinessForClient(db as never, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(r.hasConnection, false);
    assert.equal(r.canScheduleSingle, false);
    assert.ok(r.missingConfig.includes("CONTENT360_CONNECTION"));
  });

  it("readiness with connection and API allows schedule flags", async () => {
    process.env.CONTENT360_ENABLED = "true";
    process.env.CONTENT360_API_BASE = "https://api.example.test";
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy() {
                    return {
                      limit: async () => [{ connectionStatus: "active" }],
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
    const r = await buildContent360ReadinessForClient(db as never, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(r.hasConnection, true);
    assert.equal(r.canScheduleSingle, true);
    assert.equal(r.canScheduleBatch, true);
  });
});

describe("Content360 webhook signature", () => {
  const prev = process.env.CONTENT360_WEBHOOK_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CONTENT360_WEBHOOK_SECRET;
    else process.env.CONTENT360_WEBHOOK_SECRET = prev;
  });

  it("verifyContent360WebhookSignature rejects wrong secret", () => {
    process.env.CONTENT360_WEBHOOK_SECRET = "abc";
    const body = '{"type":"ping"}';
    const good = crypto.createHmac("sha256", "abc").update(body, "utf8").digest("hex");
    assert.equal(verifyContent360WebhookSignature(good, body), true);
    assert.equal(verifyContent360WebhookSignature("deadbeef", body), false);
  });
});

describe("content360 smoke script guard", () => {
  it("exits non-zero when CONTENT360_SMOKE_TEST is not set", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const env = { ...process.env };
    delete env.CONTENT360_SMOKE_TEST;
    const r = spawnSync("node", ["--import", "tsx", "scripts/content360-smoke-test.ts"], {
      cwd: root,
      env,
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0, r.stderr ?? r.stdout);
  });
});
