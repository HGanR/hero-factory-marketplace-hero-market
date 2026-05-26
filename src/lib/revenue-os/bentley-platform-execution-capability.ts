/**
 * Client + server: how a platform row should behave in Bentley execution UI vs publish adapters.
 * Keep in sync with `src/lib/social/adapters/index.ts` (platforms with non-null adapters).
 */

/** Platforms where `getAdapter(p)` is non-null today — update when adding adapters. */
const AUTO_PUBLISH_PLATFORM_IDS = new Set<string>(["linkedin", "instagram", "facebook"]);

const MANUAL_OAUTH_NO_ADAPTER = new Set<string>(["tiktok", "pinterest", "snapchat", "x"]);

export type BentleyExecutionCapability = "auto_publish" | "manual_oauth" | "export_only";

/**
 * - `auto_publish`: Non-null publish adapter in Hero.
 * - `manual_oauth`: OAuth-capable id in product surface but adapter not implemented (e.g. TikTok).
 * - `export_only`: No automated publish path in Hero (Reddit, Nextdoor, unknown strings).
 */
export function getBentleyPlatformExecutionCapability(platform: unknown): BentleyExecutionCapability {
  const low = typeof platform === "string" ? platform.trim().toLowerCase() : String(platform ?? "").trim().toLowerCase();
  if (low === "reddit" || low === "nextdoor") return "export_only";
  if (AUTO_PUBLISH_PLATFORM_IDS.has(low)) return "auto_publish";
  if (MANUAL_OAUTH_NO_ADAPTER.has(low)) return "manual_oauth";
  return "export_only";
}

export function bentleyExecutionCapabilityLabel(cap: BentleyExecutionCapability): {
  badge: string;
  short: string;
} {
  switch (cap) {
    case "auto_publish":
      return { badge: "Auto", short: "Auto" };
    case "manual_oauth":
      return { badge: "Manual", short: "Manual" };
    default:
      return { badge: "Export", short: "Export" };
  }
}
