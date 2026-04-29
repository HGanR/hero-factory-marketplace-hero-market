/**
 * Server-side asset URL preflight: HEAD request to verify fetchability.
 * Used at publish time to ensure blueprint only references known-good URLs.
 */
export async function preflightUrl(url: string): Promise<boolean> {
  if (!url || (!url.startsWith("http") && !url.startsWith("//"))) return false;
  const fetchUrl = url.startsWith("//") ? `https:${url}` : url;
  try {
    const res = await fetch(fetchUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "TroothHurtz-Oasis/1.0" },
    });
    const ct = res.headers.get("content-type") ?? "";
    return res.ok && (res.headers.has("content-length") || ct.includes("gltf") || ct.includes("binary"));
  } catch {
    return false;
  }
}
