import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  AdminJwtSecretNotConfiguredError,
  npcJwtPayloadIsAdmin,
  resolveAdminJwtSecret,
  signNpcAdminSessionTokens,
  verifyNpcAdminJwt,
} from "@/lib/admin/admin-session-jwt";

const ENV_KEYS = ["JWT_SECRET", "NODE_ENV"] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function restoreEnv(snap: Record<(typeof ENV_KEYS)[number], string | undefined>) {
  for (const key of ENV_KEYS) {
    const v = snap[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
}

describe("resolveAdminJwtSecret", () => {
  afterEach(() => {
    // per-test restore handled in each it
  });

  it("uses JWT_SECRET when set", () => {
    const snap = snapshotEnv();
    try {
      process.env.JWT_SECRET = "unit-test-secret-value";
      process.env.NODE_ENV = "production";
      assert.equal(resolveAdminJwtSecret(), "unit-test-secret-value");
    } finally {
      restoreEnv(snap);
    }
  });

  it("throws in production when JWT_SECRET is missing", () => {
    const snap = snapshotEnv();
    try {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "production";
      assert.throws(() => resolveAdminJwtSecret(), AdminJwtSecretNotConfiguredError);
    } finally {
      restoreEnv(snap);
    }
  });

  it("allows dev fallback when not production and JWT_SECRET is missing", () => {
    const snap = snapshotEnv();
    try {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "development";
      assert.equal(resolveAdminJwtSecret(), "fallback-secret");
    } finally {
      restoreEnv(snap);
    }
  });
});

describe("admin session JWT sign/verify", () => {
  it("signs and verifies in development without JWT_SECRET", async () => {
    const snap = snapshotEnv();
    try {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "development";
      const { adminToken } = await signNpcAdminSessionTokens({ userId: 7, username: "admin" });
      const payload = await verifyNpcAdminJwt(adminToken);
      assert.equal(npcJwtPayloadIsAdmin(payload), true);
      assert.equal(payload?.userId, 7);
    } finally {
      restoreEnv(snap);
    }
  });

  it("rejects sign in production without JWT_SECRET", async () => {
    const snap = snapshotEnv();
    try {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "production";
      await assert.rejects(
        () => signNpcAdminSessionTokens({ userId: 1, username: "admin" }),
        AdminJwtSecretNotConfiguredError,
      );
    } finally {
      restoreEnv(snap);
    }
  });

  it("verify rethrows configuration error in production", async () => {
    const snap = snapshotEnv();
    try {
      process.env.JWT_SECRET = "unit-test-secret-value";
      process.env.NODE_ENV = "development";
      const { adminToken } = await signNpcAdminSessionTokens({ userId: 1, username: "admin" });
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = "production";
      await assert.rejects(() => verifyNpcAdminJwt(adminToken), AdminJwtSecretNotConfiguredError);
    } finally {
      restoreEnv(snap);
    }
  });
});
