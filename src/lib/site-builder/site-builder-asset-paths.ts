/**
 * Filesystem paths for site-builder uploads — Node-only (API routes / export).
 * Kept separate from `site-builder-asset.ts` so Zod schemas can load in the browser.
 */
import path from "node:path";

export function siteBuilderAssetAbsoluteDir(): string {
  return path.join(process.cwd(), "uploads", "site-builder");
}

export function siteBuilderAssetAbsolutePath(relativePathUnderRoot: string): string {
  return path.join(siteBuilderAssetAbsoluteDir(), relativePathUnderRoot);
}
