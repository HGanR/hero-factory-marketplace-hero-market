/**
 * Server-only Vercel Domains API helpers. Never import in client components.
 * Requires `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID` (or `SITE_BUILDER_VERCEL_PROJECT_ID`).
 */
export function getVercelProjectIdForSiteBuilder(): string | null {
  return (
    (typeof process !== "undefined" && (process.env.SITE_BUILDER_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID)?.trim()) ||
    null
  );
}

export function getVercelApiToken(): string | null {
  return (typeof process !== "undefined" && process.env.VERCEL_API_TOKEN?.trim()) || null;
}

export type VercelDomainRecord = { type: string; name: string; value: string; ttl?: number };

export async function vercelAddProjectDomain(projectId: string, domain: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: domain }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((j.error as { message?: string } | undefined)?.message || `Vercel add domain failed (${res.status})`);
  }
  return j;
}

/**
 * Returns recommended DNS configuration for a domain (when Vercel is authoritative for instructions).
 * @see https://vercel.com/docs/rest-api/endpoints#domains
 */
export async function vercelGetDomainConfig(domain: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (j.error as { message?: string } | undefined)?.message || `Vercel domain config failed (${res.status})`,
    );
  }
  return j;
}

/** Map Vercel /v6 config response to flat records (best-effort; shape varies by domain state). */
export function vercelConfigToRecordHints(config: unknown): VercelDomainRecord[] {
  const out: VercelDomainRecord[] = [];
  const c = config as {
    misconfigured?: boolean;
    records?: Array<{ type?: string; name?: string; value?: string; ttl?: number }>;
  };
  if (Array.isArray(c.records)) {
    for (const r of c.records) {
      const type = (r.type ?? "TXT").toUpperCase();
      const name = (r.name ?? "@").toString();
      const value = (r.value ?? "").toString();
      if (!value) continue;
      out.push({ type, name, value, ttl: r.ttl });
    }
  }
  return out;
}
