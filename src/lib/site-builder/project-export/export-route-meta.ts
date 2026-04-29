/** Shared route/folder naming for static HTML, Next.js App Router, and handoff manifests. */

export function nextRouteSegment(slug: string): string {
  const s = slug.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return (s || "page").slice(0, 64);
}

export function componentFolderForPageSlug(slug: string): string {
  const flat = slug === "/" ? "index" : slug.replaceAll("/", "").trim() || "index";
  return flat === "index" ? "home" : nextRouteSegment(flat);
}
