/**
 * Client helpers for canonical Trust APIs.
 *
 * Centralizes fetch logic so pages don't reintroduce ad-hoc trust creation/saving.
 */
export type TrustCreateSource = "trust-records" | "wizard" | "besu";

export function isUuidLike(s: string): boolean {
  // Accept canonical UUID v4-ish format (case-insensitive). We keep it permissive for future UUID versions.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export async function createTrust(opts?: { source?: TrustCreateSource }): Promise<{ trustId: string; status: string }> {
  const res = await fetch("/api/trusts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts?.source ? { source: opts.source } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to create trust (${res.status})`);
  }
  const data = await res.json();
  return { trustId: String(data.trustId || ""), status: String(data.status || "draft") };
}

export async function saveTrustDraft(params: {
  trustId: string;
  draftType: string;
  schemaVersion: number;
  payload: unknown;
}): Promise<{ draftId: string; version: number }> {
  const res = await fetch(`/api/trusts/${encodeURIComponent(params.trustId)}/draft`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftType: params.draftType,
      schemaVersion: params.schemaVersion,
      payload: params.payload,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to save draft (${res.status})`);
  }
  const data = await res.json();
  return { draftId: String(data.draftId || ""), version: Number(data.version ?? 0) };
}

export async function loadLatestTrustDraft(params: {
  trustId: string;
  draftType: string;
}): Promise<{ payload: unknown; version: number } | null> {
  const url = `/api/trusts/${encodeURIComponent(params.trustId)}/draft?draftType=${encodeURIComponent(params.draftType)}`;
  const res = await fetch(url, { method: "GET", credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load draft (${res.status})`);
  }
  const data = await res.json();
  const d = data?.draft;
  if (!d) return null;
  return { payload: d.payload, version: Number(d.version ?? 0) };
}



