import { spawnSync } from "child_process";
import path from "path";
import type { SiteSchemaDocumentType } from "../../src/lib/site-builder/schema";

const REPO_ROOT = path.resolve(__dirname, "../..");
const SSR_SCRIPT = path.join(REPO_ROOT, "scripts/site-builder-parity-preview-ssr.ts");

/** Same HTML as `buildPreviewParityHtmlString`, but rendered in a clean Node process (see script header). */
export function buildPreviewParityHtmlString(doc: SiteSchemaDocumentType): string {
  const r = spawnSync("npx", ["tsx", SSR_SCRIPT], {
    cwd: REPO_ROOT,
    input: JSON.stringify(doc),
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr?.toString() || `parity preview SSR failed (exit ${r.status})`);
  }
  return r.stdout as string;
}
