/**
 * Central Content360 environment evaluation. Safe at import time: never throws.
 * Used by readiness API, schedule guards, and smoke script helpers.
 */

const TRUEISH = new Set(["1", "true", "yes", "on"]);

/** Live feature flag: scheduling APIs no-op when false. Default unset = disabled. */
export function isContent360FeatureEnabled(): boolean {
  const raw = process.env.CONTENT360_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return TRUEISH.has(raw);
}

export function isContent360ApiBaseConfigured(): boolean {
  return Boolean(process.env.CONTENT360_BASE_URL?.trim() || process.env.CONTENT360_API_BASE?.trim());
}

export function getContent360ApiBase(): string | null {
  const fromNew = process.env.CONTENT360_BASE_URL?.trim();
  const fromLegacy = process.env.CONTENT360_API_BASE?.trim();
  const b = (fromNew || fromLegacy || "").replace(/\/+$/, "");
  return b.length > 0 ? b : null;
}

export function getContent360RequestTimeoutMs(): number {
  const raw = process.env.CONTENT360_REQUEST_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1000) return 30_000;
  return Math.min(n, 120_000);
}

export function hasContent360WebhookSecretConfigured(): boolean {
  return Boolean(process.env.CONTENT360_WEBHOOK_SECRET?.trim());
}

/** Vendor HTTP cancel path is still stubbed (501) until API docs land. */
export function isContent360VendorCancelImplemented(): boolean {
  return process.env.CONTENT360_VENDOR_CANCEL_READY?.trim().toLowerCase() === "true";
}

/** Vendor HTTP job status path is still stubbed (501) until API docs land. */
export function isContent360VendorSyncImplemented(): boolean {
  return process.env.CONTENT360_VENDOR_SYNC_READY?.trim().toLowerCase() === "true";
}

export type Content360EnvEvaluation = {
  featureEnabled: boolean;
  providerConfigured: boolean;
  requestTimeoutMs: number;
  webhookSecretConfigured: boolean;
  missing: string[];
  warnings: string[];
};

/**
 * Structured env readiness (no DB). Does not validate URL reachability.
 */
export function evaluateContent360Env(): Content360EnvEvaluation {
  const missing: string[] = [];
  const warnings: string[] = [];

  const featureEnabled = isContent360FeatureEnabled();
  const providerConfigured = isContent360ApiBaseConfigured();
  const requestTimeoutMs = getContent360RequestTimeoutMs();
  const webhookSecretConfigured = hasContent360WebhookSecretConfigured();

  if (featureEnabled && !providerConfigured) {
    missing.push("CONTENT360_BASE_URL or CONTENT360_API_BASE");
    warnings.push("Content360 is enabled but no API base URL is set — outbound scheduling will use stub responses.");
  }

  if (providerConfigured && !featureEnabled) {
    warnings.push(
      "CONTENT360_BASE_URL / CONTENT360_API_BASE is set but CONTENT360_ENABLED is not true — scheduling APIs remain off until enabled.",
    );
  }

  const base = getContent360ApiBase();
  if (base) {
    try {
      // eslint-disable-next-line no-new -- URL validation only
      new URL(base.includes("://") ? base : `https://${base}`);
    } catch {
      warnings.push("Content360 API base URL does not look like a valid URL.");
    }
  }

  if (
    (process.env.CONTENT360_PLATFORM_API_KEY?.trim() || process.env.CONTENT360_API_KEY?.trim()) &&
    !process.env.CONTENT360_PLATFORM_API_KEY_HEADER?.trim()
  ) {
    warnings.push(
      "A platform API key is set without CONTENT360_PLATFORM_API_KEY_HEADER — wire custom headers when the vendor requires non-Bearer auth.",
    );
  }

  return {
    featureEnabled,
    providerConfigured,
    requestTimeoutMs,
    webhookSecretConfigured,
    missing,
    warnings,
  };
}

export type Content360ScheduleGateResult =
  | { ok: true }
  | { ok: false; error: string; code: "CONTENT360_DISABLED"; status: number };

/** Guard for schedule / schedule-batch POST handlers. */
export function gateContent360Scheduling(): Content360ScheduleGateResult {
  if (!isContent360FeatureEnabled()) {
    return {
      ok: false,
      error: "Content360 scheduling is disabled for this deployment (CONTENT360_ENABLED).",
      code: "CONTENT360_DISABLED",
      status: 403,
    };
  }
  return { ok: true };
}

/** Smoke script must call this first — tested. */
export function assertContent360SmokeTestMode(): void {
  if (process.env.CONTENT360_SMOKE_TEST !== "1") {
    throw new Error("Refusing to run: set CONTENT360_SMOKE_TEST=1 for an explicit smoke test.");
  }
}
