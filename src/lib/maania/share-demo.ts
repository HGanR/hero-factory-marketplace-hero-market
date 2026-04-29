export type MaaniaShareKind = "buyer" | "ret";

export type CreateMaaniaShareInput = {
  kind: MaaniaShareKind;
  title: string;
  payload: unknown;
  schema: unknown;
};

export type CreateMaaniaShareResult =
  | { ok: true; path: string; slug: string }
  | { ok: false; error: string; status?: number };

/**
 * Persists a MAANIA-generated demo server-side and returns the public path (`/demo/[slug]`).
 */
export async function createMaaniaShare(input: CreateMaaniaShareInput): Promise<CreateMaaniaShareResult> {
  try {
    const res = await fetch("/api/demo/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as { path?: string; slug?: string; error?: string };
    if (!res.ok) {
      return { ok: false, error: data?.error || `Share failed (${res.status})`, status: res.status };
    }
    if (typeof data.path !== "string" || typeof data.slug !== "string") {
      return { ok: false, error: "Invalid share response" };
    }
    return { ok: true, path: data.path, slug: data.slug };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function copyMaaniaShareLinkToClipboard(input: CreateMaaniaShareInput): Promise<CreateMaaniaShareResult> {
  const r = await createMaaniaShare(input);
  if (!r.ok) return r;
  const absolute =
    typeof window !== "undefined" ? `${window.location.origin}${r.path}` : r.path;
  try {
    await navigator.clipboard.writeText(absolute);
  } catch {
    return { ok: false, error: "Could not copy to clipboard" };
  }
  return r;
}
