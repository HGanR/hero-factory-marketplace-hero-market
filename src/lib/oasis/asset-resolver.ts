/**
 * Asset resolver: assetRef (element id or URI) → loadable URL + metadata.
 * Never let unknown assetRefs reach the renderer; replace with fallback at resolution time.
 */
import { toGatewayUrl } from "@/lib/ipfs-gateway";
import type { OasisWorldElement } from "@/lib/db/schema";

export type ResolvedAsset = {
  id: string | number;
  name: string;
  url: string;
  bounds: [number, number, number]; // [x,y,z] meters, conservative
  defaultScale: number;
  colliderType: "box" | "sphere" | "mesh" | "none";
  tags: string[];
};

const DEFAULT_BOUNDS: [number, number, number] = [2, 2, 2];
const DEFAULT_SCALE = 1;
const DEFAULT_COLLIDER: ResolvedAsset["colliderType"] = "box";

function parseBounds(raw: string | null): [number, number, number] {
  if (!raw) return DEFAULT_BOUNDS;
  try {
    const parsed = JSON.parse(raw) as number[] | { x?: number; y?: number; z?: number };
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return [Number(parsed[0]) || 1, Number(parsed[1]) || 1, Number(parsed[2]) || 1];
    }
    if (parsed && typeof parsed === "object") {
      const x = Number((parsed as { x?: number }).x) || 1;
      const y = Number((parsed as { y?: number }).y) || 1;
      const z = Number((parsed as { z?: number }).z) || 1;
      return [x, y, z];
    }
  } catch {
    // ignore
  }
  return DEFAULT_BOUNDS;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Resolve element to loadable URL and metadata.
 * Prefers cached resolvedUrl when present and non-empty.
 */
export function resolveElementToAsset(
  el: Pick<OasisWorldElement, "id" | "name" | "assetUri" | "tags" | "assetBounds" | "defaultScale" | "colliderType"> &
    { resolvedUrl?: string | null }
): ResolvedAsset {
  let url = el.resolvedUrl?.trim() || "";
  if (!url) {
    url = el.assetUri || "";
    if (url.startsWith("ipfs://")) {
      url = toGatewayUrl(url);
    } else if (!url.startsWith("http") && !url.startsWith("/")) {
      url = url.startsWith("//") ? `https:${url}` : `/api/oasis/assets/${el.id}/file`;
    }
  }

  const colliderRaw = (el as { colliderType?: string }).colliderType;
  const colliderType: ResolvedAsset["colliderType"] =
    colliderRaw === "sphere" || colliderRaw === "mesh" || colliderRaw === "none"
      ? colliderRaw
      : "box";

  const scaleRaw = (el as { defaultScale?: string | number }).defaultScale;
  const defaultScale =
    typeof scaleRaw === "number" ? scaleRaw : scaleRaw ? parseFloat(String(scaleRaw)) || DEFAULT_SCALE : DEFAULT_SCALE;

  return {
    id: el.id,
    name: el.name,
    url,
    bounds: parseBounds((el as { assetBounds?: string }).assetBounds ?? null),
    defaultScale,
    colliderType,
    tags: parseTags(el.tags ?? null),
  };
}

/**
 * Build a map of assetId -> ResolvedAsset from elements.
 * Use element id as assetId (existing blueprint contract).
 */
export function buildAssetMap(
  elements: (Pick<OasisWorldElement, "id" | "name" | "assetUri" | "tags" | "assetBounds" | "defaultScale" | "colliderType"> & { resolvedUrl?: string | null })[]
): Map<string | number, ResolvedAsset> {
  const map = new Map<string | number, ResolvedAsset>();
  for (const el of elements) {
    if (el.assetUri && (el.assetUri.endsWith(".glb") || el.assetUri.endsWith(".gltf") || el.assetUri.startsWith("ipfs://"))) {
      map.set(el.id, resolveElementToAsset(el));
    }
  }
  return map;
}
