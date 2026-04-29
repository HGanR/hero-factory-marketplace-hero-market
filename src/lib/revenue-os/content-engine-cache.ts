import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";

/** Last Content Engine generation on Revenue OS dashboard (session-only). */
export const REVENUE_OS_CONTENT_ENGINE_CACHE_KEY = "revenue-os:content-engine-last";

export function readCachedContentEngineOutput(): ContentEngineOutput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(REVENUE_OS_CONTENT_ENGINE_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Partial<ContentEngineOutput>;
    if (!o.fullPost || typeof o.fullPost !== "object") return null;
    return j as ContentEngineOutput;
  } catch {
    return null;
  }
}

export function writeCachedContentEngineOutput(output: ContentEngineOutput | null): void {
  if (typeof window === "undefined") return;
  try {
    if (output === null) sessionStorage.removeItem(REVENUE_OS_CONTENT_ENGINE_CACHE_KEY);
    else sessionStorage.setItem(REVENUE_OS_CONTENT_ENGINE_CACHE_KEY, JSON.stringify(output));
  } catch {
    // ignore quota
  }
}
