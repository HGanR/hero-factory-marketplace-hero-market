/** Parse `clients.requested_services_json` or hub `servicesJson` safely. */
export function parseRequestedServicesJson(raw: string | null | undefined): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return [...new Set(p.map((x) => String(x ?? "").trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

/** CRM list first; append hub-only entries not already present. */
export function mergeRequestedServicesLists(crm: string[], hub: string[]): string[] {
  const out = [...crm];
  const seen = new Set(crm);
  for (const h of hub) {
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}
