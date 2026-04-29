import { readFile } from "fs/promises";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { AssetStrategy, DeploymentTarget } from "@/lib/site-builder/refinement-schema";
import {
  siteBuilderAssetAbsolutePath,
} from "@/lib/site-builder/site-builder-asset-paths";
import {
  siteBuilderAssetRelativeStoragePath,
  zipAssetBaseName,
  type SiteBuilderAssetRecord,
} from "@/lib/site-builder/site-builder-asset";
import type { ProjectExportFile } from "./types";

export type AssetBundleResult = {
  bundledCount: number;
  missingStorageKeys: string[];
};

function sanitizeThemeSlug(schema: SiteSchemaDocumentType): string {
  const t = (schema.metadata?.title || "site-builder-theme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site-builder-theme";
  return t.slice(0, 60);
}

export type ResolvedAssetForExport =
  | { status: "local_bundle"; relativeRef: string; zipRelativePath: string; zipName: string }
  | { status: "remote_urls"; url: string }
  | { status: "missing"; fallback: string };

/**
 * Export-layer resolution only: path/URL to embed in bundled output.
 * - `local_bundle` → ZIP-relative reference string for HTML/CSS/TSX
 * - `remote_urls` → keep app or absolute URL (no file copy here)
 * - missing record → safe empty fallback (caller skips rewrite / copy)
 */
export function resolveAssetForExport(
  assetId: string,
  strategy: AssetStrategy,
  target: DeploymentTarget,
  ctx: { asset?: SiteBuilderAssetRecord; themeSlug: string },
): ResolvedAssetForExport {
  const asset = ctx.asset;
  const diskRel = asset ? siteBuilderAssetRelativeStoragePath(asset) : "";
  if (!asset || diskRel.length === 0 || asset.assetId !== assetId) {
    return { status: "missing", fallback: "" };
  }
  if (strategy === "remote_urls") {
    const url = asset.publicUrl?.trim() || `/api/site-builder/assets/${asset.assetId}`;
    return { status: "remote_urls", url };
  }
  const zipName = zipAssetBaseName(asset);
  return {
    status: "local_bundle",
    relativeRef: bundledAssetReference(zipName, asset.kind, target),
    zipRelativePath: zipPathForAsset(zipName, asset.kind, target, ctx.themeSlug),
    zipName,
  };
}

function zipPathForAsset(
  zipName: string,
  kind: "image" | "video",
  target: DeploymentTarget,
  themeSlug: string,
): string {
  const sub = kind === "video" ? "video" : "images";
  switch (target) {
    case "vercel_nextjs":
      return `public/${sub}/${zipName}`;
    case "wordpress_theme":
      return `wordpress-theme/${themeSlug}/assets/${sub}/${zipName}`;
    case "gohighlevel_embed":
      return `embed/assets/${sub}/${zipName}`;
    default:
      return `assets/${sub}/${zipName}`;
  }
}

/** URL/path string to embed in exported HTML/CSS/TSX when bundling. */
export function bundledAssetReference(
  zipName: string,
  kind: "image" | "video",
  target: DeploymentTarget,
): string {
  const sub = kind === "video" ? "video" : "images";
  switch (target) {
    case "vercel_nextjs":
      return kind === "video" ? `/video/${zipName}` : `/images/${zipName}`;
    case "wordpress_theme":
      return `<?php echo esc_url( get_template_directory_uri() ); ?>/assets/${sub}/${zipName}`;
    case "gohighlevel_embed":
      return `./assets/${sub}/${zipName}`;
    default:
      return `./assets/${sub}/${zipName}`;
  }
}

function collectUrlNeedlesFromAsset(asset: SiteBuilderAssetRecord): string[] {
  const u = (asset.publicUrl?.trim() || `/api/site-builder/assets/${asset.assetId}`).trim();
  const out = new Set<string>();
  if (u) out.add(u);
  const base = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") : "";
  if (base && u.startsWith("/")) out.add(`${base}${u}`);
  const vercel = typeof process !== "undefined" ? process.env.VERCEL_URL?.replace(/\/$/, "") : "";
  if (vercel && u.startsWith("/")) out.add(`https://${vercel}${u}`);
  return [...out].sort((a, b) => b.length - a.length);
}

function rewriteTextExportUrls(text: string, pairs: Array<{ from: string; to: string }>): string {
  let s = text;
  for (const { from, to } of pairs) {
    if (!from) continue;
    s = s.split(from).join(to);
  }
  return s;
}

function appendReadmeNote(files: ProjectExportFile[], note: string) {
  const block = `\n\n## Export — assets\n\n${note}\n`;
  const idx = files.findIndex((f) => f.path === "README.md");
  if (idx >= 0) {
    const f = files[idx]!;
    if (typeof f.content === "string") {
      files[idx] = { ...f, content: f.content + block };
      return;
    }
  }
  const themeReadme = files.find((f) => f.path.endsWith("/README.md") && typeof f.content === "string");
  if (themeReadme) {
    themeReadme.content = (themeReadme.content as string) + block;
    return;
  }
  files.push({ path: "EXPORT_ASSETS_README.txt", content: note.trim(), contentType: "text/plain" });
}

/**
 * When `assetStrategy === local_bundle`, copies uploaded builder assets into the ZIP and rewrites
 * references in text-based export files. Keeps remote `http(s)` URLs unchanged.
 */
export async function applySiteBuilderAssetBundle(
  files: ProjectExportFile[],
  schema: SiteSchemaDocumentType,
  opts: {
    userId: number;
    assetStrategy: AssetStrategy;
    deploymentTarget: DeploymentTarget;
  },
): Promise<AssetBundleResult> {
  const raw = schema.metadata?.siteBuilderAssets as Record<string, SiteBuilderAssetRecord> | undefined;
  if (!raw || typeof raw !== "object") {
    return { bundledCount: 0, missingStorageKeys: [] };
  }

  const assets = Object.values(raw).filter(
    (a) => a && typeof a.assetId === "string" && siteBuilderAssetRelativeStoragePath(a).length > 0,
  );
  if (!assets.length) {
    return { bundledCount: 0, missingStorageKeys: [] };
  }

  const themeSlug = sanitizeThemeSlug(schema);
  const missingStorageKeys: string[] = [];
  const pairs: Array<{ from: string; to: string }> = [];
  let bundledCount = 0;

  if (opts.assetStrategy === "local_bundle") {
    for (const asset of assets) {
      const diskRel = siteBuilderAssetRelativeStoragePath(asset);
      if (!diskRel.startsWith(`${opts.userId}/`)) {
        missingStorageKeys.push(diskRel);
        continue;
      }
      const resolved = resolveAssetForExport(asset.assetId, opts.assetStrategy, opts.deploymentTarget, {
        asset,
        themeSlug,
      });
      if (resolved.status !== "local_bundle") {
        missingStorageKeys.push(diskRel);
        continue;
      }
      const abs = siteBuilderAssetAbsolutePath(diskRel);
      let buf: Buffer;
      try {
        buf = await readFile(abs);
      } catch {
        missingStorageKeys.push(diskRel);
        continue;
      }

      files.push({ path: resolved.zipRelativePath, content: buf, contentType: asset.mimeType });
      bundledCount += 1;

      const to = resolved.relativeRef;
      for (const needle of collectUrlNeedlesFromAsset(asset)) {
        pairs.push({ from: needle, to });
      }
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      if (typeof f.content !== "string") continue;
      if (!/\.(html?|css|tsx?|jsx|php|md|txt|js)$/i.test(f.path) && !f.path.endsWith("page.tsx")) continue;
      files[i] = {
        ...f,
        content: rewriteTextExportUrls(f.content, pairs),
      };
    }
  }

  const notes: string[] = [];
  if (opts.assetStrategy === "remote_urls") {
    notes.push(
      "Asset strategy is **remote URLs**: external `https://` links are unchanged. App-hosted uploads (`/api/site-builder/assets/...`) stay as-is and only work while this app serves them — switch to **Bundle locally** for offline ZIPs.",
    );
  }
  if (missingStorageKeys.length) {
    notes.push(
      `Some builder uploads were missing on the server or failed resolution and were skipped: ${missingStorageKeys.length} file(s). Re-upload or use a URL instead.`,
    );
  }
  if (notes.length) {
    appendReadmeNote(files, notes.join("\n\n"));
  }

  return {
    bundledCount: opts.assetStrategy === "local_bundle" ? bundledCount : 0,
    missingStorageKeys,
  };
}
