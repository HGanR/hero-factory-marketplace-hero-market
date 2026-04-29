/**
 * ERC-1155 tokenURI-style resolution (server- and client-safe).
 */

export function substituteErc1155Uri(uri: string, id: bigint): string {
  if (!uri.includes("{id}")) return uri;
  const hex = id.toString(16);
  return uri.split("{id}").join(hex);
}

export function normalizeIpfsToHttp(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("ipfs://")) {
    return t.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  return t;
}

function parseDataApplicationJson(substituted: string): Record<string, unknown> | null {
  try {
    const comma = substituted.indexOf(",");
    if (comma < 0) return null;
    const header = substituted.slice(0, comma);
    const payload = substituted.slice(comma + 1);
    const isBase64 = /;base64/i.test(header);
    const jsonStr = isBase64
      ? Buffer.from(payload.replace(/\s/g, ""), "base64").toString("utf8")
      : decodeURIComponent(payload);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type ResolvedMetadata = {
  name: string;
  image: string | null;
  description: string | null;
  animationUrl: string | null;
  externalUrl: string | null;
};

export async function resolveUriToMetadata(
  uriTemplate: string,
  id: bigint,
  fallbackName: string
): Promise<ResolvedMetadata | null> {
  const substituted = substituteErc1155Uri(uriTemplate, id);
  const empty = (): ResolvedMetadata => ({
    name: fallbackName,
    image: null,
    description: null,
    animationUrl: null,
    externalUrl: null,
  });

  if (substituted.startsWith("data:application/json")) {
    const meta = parseDataApplicationJson(substituted);
    if (!meta) return null;
    let image = String(meta.image ?? meta.image_url ?? "").trim();
    if (image.startsWith("ipfs://")) image = normalizeIpfsToHttp(image);
    return {
      name: (String(meta.name ?? fallbackName).trim() || fallbackName) as string,
      image: image || null,
      description: meta.description != null ? String(meta.description) : null,
      animationUrl:
        meta.animation_url != null ? normalizeIpfsToHttp(String(meta.animation_url)) : null,
      externalUrl: meta.external_url != null ? String(meta.external_url) : null,
    };
  }

  const url = normalizeIpfsToHttp(substituted);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json") || /\.json($|\?)/i.test(url.split("#")[0])) {
      const meta = (await res.json()) as Record<string, unknown>;
      let image = String(meta.image ?? meta.image_url ?? "").trim();
      if (image.startsWith("ipfs://")) image = normalizeIpfsToHttp(image);
      return {
        name: (String(meta.name ?? fallbackName).trim() || fallbackName) as string,
        image: image || null,
        description: meta.description != null ? String(meta.description) : null,
        animationUrl:
          meta.animation_url != null ? normalizeIpfsToHttp(String(meta.animation_url)) : null,
        externalUrl: meta.external_url != null ? String(meta.external_url) : null,
      };
    }
    if (ct.startsWith("image/")) {
      return {
        name: fallbackName,
        image: url,
        description: null,
        animationUrl: null,
        externalUrl: null,
      };
    }
  } catch {
    return null;
  }
  return null;
}
