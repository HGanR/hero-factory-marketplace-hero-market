/**
 * Structured, masked audit events for broadcast operations (no stream keys or full RTMP URLs).
 * Consume from log drain / APM; grep-friendly JSON lines.
 *
 * Optional debug fields (when present):
 * - providerCapabilitiesSnapshot — compact platform:tier string from `providerCapabilitiesSnapshot()`
 * - warningCount — resolver/preflight warning lines (count only)
 * - degradedAtStart — true only when session already had explicit failed destination rows before the audited action (usually false on start)
 */
export type BroadcastAuditPayload = Record<string, string | number | boolean | null | undefined>;

export function broadcastAudit(event: string, payload: BroadcastAuditPayload): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    component: "meet_broadcast",
    event,
    ...payload,
  });
  console.info(line);
}
