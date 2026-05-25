import "server-only";

/**
 * Platform-owner Content360 credentials (ADMIN / single-tenant).
 * Separate from per-client OAuth tokens on `client_provider_connections`.
 *
 * Supports prompt names:
 * - CONTENT360_BASE_URL (alias for legacy CONTENT360_API_BASE)
 * - CONTENT360_API_KEY (alias for legacy CONTENT360_PLATFORM_API_KEY)
 */

import { isContent360PlatformConfiguredFromEnv } from "@/lib/content360/content360-platform-env-read";

const TRUEISH = new Set(["1", "true", "yes", "on"]);

export function getContent360PlatformBaseUrl(): string | null {
  const fromNew = process.env.CONTENT360_BASE_URL?.trim();
  const fromLegacy = process.env.CONTENT360_API_BASE?.trim();
  const b = (fromNew || fromLegacy || "").replace(/\/+$/, "");
  return b.length > 0 ? b : null;
}

export function getContent360PlatformApiKey(): string | null {
  const fromNew = process.env.CONTENT360_API_KEY?.trim();
  const fromLegacy = process.env.CONTENT360_PLATFORM_API_KEY?.trim();
  const k = (fromNew || fromLegacy || "").trim();
  return k.length > 0 ? k : null;
}

export function getContent360PlatformApiKeyHeaderName(): string | null {
  const h = process.env.CONTENT360_PLATFORM_API_KEY_HEADER?.trim();
  return h && h.length > 0 ? h : null;
}

export function isContent360PlatformConfigured(): boolean {
  return isContent360PlatformConfiguredFromEnv();
}

export function getContent360PlatformRequestTimeoutMs(): number {
  const raw = process.env.CONTENT360_REQUEST_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1000) return 30_000;
  return Math.min(n, 120_000);
}

/** Optional override for auth probe (default `/v1/me` then `/me`). */
export function getContent360AuthProbePath(): string {
  const p = process.env.CONTENT360_AUTH_PROBE_PATH?.trim();
  return p && p.startsWith("/") ? p : "/v1/me";
}

/** POST path for platform publish (admin adapter). */
export function getContent360PlatformPublishPath(): string {
  const p = process.env.CONTENT360_PUBLISH_PATH?.trim();
  return p && p.startsWith("/") ? p : "/v1/posts";
}

export function isContent360FeatureEnabledGlobal(): boolean {
  const raw = process.env.CONTENT360_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return TRUEISH.has(raw);
}
