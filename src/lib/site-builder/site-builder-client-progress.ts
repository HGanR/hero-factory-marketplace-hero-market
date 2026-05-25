/**
 * In-browser progress for Site Builder when a Revenue OS client is selected
 * but there is no site project yet (or the site has no saved version).
 * Server-side progress uses POST /api/site-builder/sites/:id/versions once a site exists.
 */

export type ClientSiteBuilderProgress = {
  schemaText: string;
  createName?: string;
  savedAt: string;
};

const PREFIX = "site-builder-client-progress:v1:";

export function storageKeyForClientSiteBuilderProgress(clientId: string): string {
  return `${PREFIX}${encodeURIComponent(clientId.trim())}`;
}

export function persistClientSiteBuilderProgress(
  clientId: string,
  payload: Omit<ClientSiteBuilderProgress, "savedAt"> & { savedAt?: string },
): void {
  if (typeof window === "undefined") return;
  const data: ClientSiteBuilderProgress = {
    ...payload,
    savedAt: payload.savedAt ?? new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(storageKeyForClientSiteBuilderProgress(clientId), JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readClientSiteBuilderProgress(clientId: string): ClientSiteBuilderProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKeyForClientSiteBuilderProgress(clientId));
    if (!raw) return null;
    const p = JSON.parse(raw) as ClientSiteBuilderProgress;
    if (typeof p.schemaText !== "string" || !p.schemaText.trim()) return null;
    return p;
  } catch {
    return null;
  }
}

/** Prefer the most recently updated site row for the given hub client id. */
export function pickSiteIdForClientId<
  T extends { id: string; clientId?: string | null; updatedAt?: string | null },
>(items: T[], clientId: string): string {
  const pid = clientId.trim();
  if (!pid || items.length === 0) return "";
  const matches = items.filter((s) => (s.clientId || "").trim() === pid);
  if (!matches.length) return "";
  const sorted = [...matches].sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });
  return sorted[0]!.id;
}
