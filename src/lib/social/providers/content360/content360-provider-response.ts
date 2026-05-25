import type { Content360SyncDisposition } from "@/lib/social/providers/content360/content360-execute-types";

/** Normalize arbitrary provider JSON for persistence and branching (vendor-agnostic). */
export function normalizeContent360ProviderResponse(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return { ...(body as Record<string, unknown>) };
  }
  return { value: body == null ? null : String(body) };
}

export function inferContent360SyncDisposition(raw: Record<string, unknown>, httpOk: boolean): Content360SyncDisposition {
  const err = typeof raw.error === "string" ? raw.error.toLowerCase() : "";
  if (err.includes("not configured")) return "unconfigured";
  const st = `${String(raw.state ?? "")} ${String(raw.status ?? "")} ${String(raw.jobState ?? "")} ${err}`.toLowerCase();
  if (!httpOk && err) {
    if (/(cancel|revoke)/.test(st)) return "canceled";
    if (/(fail|error|reject)/.test(err)) return "failed";
  }
  if (/(published|complete|success|live|posted)/.test(st)) return "published";
  if (/(fail|error|reject)/.test(st)) return "failed";
  if (/(cancel|revok)/.test(st)) return "canceled";
  if (/(sched|queue|pend|processing)/.test(st)) return "scheduled";
  if (!httpOk) return "unknown";
  return "unknown";
}
