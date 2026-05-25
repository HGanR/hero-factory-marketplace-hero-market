export type CrossModuleAuditEntry = {
  sourceModule: string;
  action: string;
  actorUserId: string;
  ids?: Record<string, unknown>;
  note?: string;
  at: string;
};

function isAuditArray(v: unknown): v is CrossModuleAuditEntry[] {
  return Array.isArray(v);
}

/** Append an immutable audit row onto `rawPayload`-style objects (offers, deploy artifacts). */
export function appendCrossModuleAudit(
  payload: Record<string, unknown>,
  entry: Omit<CrossModuleAuditEntry, "at"> & { at?: string }
): Record<string, unknown> {
  const at = entry.at ?? new Date().toISOString();
  const row: CrossModuleAuditEntry = {
    sourceModule: entry.sourceModule,
    action: entry.action,
    actorUserId: entry.actorUserId,
    ids: entry.ids,
    note: entry.note,
    at,
  };
  const prev = isAuditArray(payload.crossModuleAudit) ? payload.crossModuleAudit : [];
  return { ...payload, crossModuleAudit: [...prev, row] };
}
