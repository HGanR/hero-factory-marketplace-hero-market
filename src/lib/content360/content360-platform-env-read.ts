/**
 * Pure `process.env` reads for platform Content360 credentials — **no `server-only`**
 * so `node:test` and workers can branch without pulling the full platform env module graph.
 */

export function isContent360PlatformConfiguredFromEnv(): boolean {
  const fromNew = process.env.CONTENT360_BASE_URL?.trim();
  const fromLegacy = process.env.CONTENT360_API_BASE?.trim();
  const b = (fromNew || fromLegacy || "").replace(/\/+$/, "");
  const fromKey = process.env.CONTENT360_API_KEY?.trim();
  const fromLegacyKey = process.env.CONTENT360_PLATFORM_API_KEY?.trim();
  const k = (fromKey || fromLegacyKey || "").trim();
  return b.length > 0 && k.length > 0;
}
