import type { HandoffComposition, PreAccountingProfile, TransactionSnapshot } from "./types";

/** Row shape from `accounting_document_records` (server). */
export type ServerDocumentRecord = {
  id: number;
  accountingProfileId: number;
  documentName: string;
  documentTag: string;
  fileUrl: string | null;
  storageKey: string | null;
  mimeType: string | null;
  reportingPeriodLabel: string | null;
  quarterLabel: string | null;
  taxYear: number;
  status: string;
  rejectionReason: string | null;
  supersedesDocumentId: number | null;
  reportType: string | null;
  ledgerContextJson: string | null;
  includeInHandoff: boolean;
  linkedFormCodesJson: string | null;
  notes: string | null;
  internalReviewerNotes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ReadinessGatePayload = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
};

export type PreAccountingWorkspaceResponse = {
  ok: boolean;
  profile: PreAccountingProfile | null;
  documents: ServerDocumentRecord[];
  readinessSnapshot: unknown | null;
  formCandidates: unknown[];
  handoffs: unknown[];
  auditLog: unknown[];
  quarterlyWorkflows: unknown[];
  reviewItems: unknown[];
  completenessSnapshot: unknown | null;
  readinessGate: ReadinessGatePayload | null;
};

export async function fetchPreAccountingWorkspace(taxYear: number): Promise<PreAccountingWorkspaceResponse | null> {
  const r = await fetch(`/api/accounting/pre-accounting?taxYear=${encodeURIComponent(String(taxYear))}`, {
    credentials: "include",
  });
  if (r.status === 401) return null;
  if (!r.ok) return null;
  return (await r.json()) as PreAccountingWorkspaceResponse;
}

export async function savePreAccountingWorkspace(
  profile: PreAccountingProfile,
  ledgerSnapshot: TransactionSnapshot,
  options?: { handoffReadinessOverrideNote?: string | null }
): Promise<
  | (PreAccountingWorkspaceResponse & { gate?: ReadinessGatePayload; error?: string })
  | null
> {
  const r = await fetch("/api/accounting/pre-accounting", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile,
      ledgerSnapshot,
      ...(options?.handoffReadinessOverrideNote != null
        ? { handoffReadinessOverrideNote: options.handoffReadinessOverrideNote }
        : {}),
    }),
  });
  if (r.status === 401) return null;
  const data = (await r.json().catch(() => ({}))) as PreAccountingWorkspaceResponse & {
    gate?: ReadinessGatePayload;
    error?: string;
  };
  if (r.status === 422) {
    return { ok: false, ...data } as PreAccountingWorkspaceResponse & { gate?: ReadinessGatePayload; error?: string };
  }
  if (!r.ok) return null;
  return data as PreAccountingWorkspaceResponse;
}

export async function createServerHandoffPacket(input: {
  profile: PreAccountingProfile;
  ledgerSnapshot: TransactionSnapshot;
  packetName?: string;
  composition?: HandoffComposition;
}): Promise<{ ok: boolean; handoffId?: number; bundleUrl?: string; error?: string }> {
  const r = await fetch("/api/accounting/pre-accounting/handoff", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    handoffId?: number;
    bundleUrl?: string;
    error?: string;
  };
  if (!r.ok) return { ok: false, error: data.error ?? "Request failed" };
  return { ok: true, handoffId: data.handoffId, bundleUrl: data.bundleUrl };
}

export async function uploadPreAccountingDocument(form: FormData): Promise<{
  ok: boolean;
  document?: ServerDocumentRecord | null;
  error?: string;
}> {
  const r = await fetch("/api/accounting/pre-accounting/documents", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    document?: ServerDocumentRecord | null;
    error?: string;
  };
  if (r.status === 401) return { ok: false, error: "Sign in to upload documents." };
  if (!r.ok) return { ok: false, error: data.error ?? "Upload failed" };
  return { ok: true, document: data.document ?? null };
}

export type PatchDocumentBody = {
  status?: string;
  notes?: string;
  internalReviewerNotes?: string;
  reportType?: string | null;
  quarterLabel?: string | null;
  ledgerContextJson?: string | null;
  linkedFormCodesJson?: string | null;
  includeInHandoff?: boolean;
  rejectionReason?: string | null;
  supersedesDocumentId?: number | null;
};

export async function patchPreAccountingDocument(
  id: number,
  body: PatchDocumentBody
): Promise<{ ok: boolean; document?: ServerDocumentRecord | null; error?: string }> {
  const r = await fetch(`/api/accounting/pre-accounting/documents/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    document?: ServerDocumentRecord | null;
    error?: string;
  };
  if (r.status === 401) return { ok: false, error: "Unauthorized" };
  if (!r.ok) return { ok: false, error: data.error ?? "Update failed" };
  return { ok: true, document: data.document ?? null };
}

export async function patchQuarterCloseout(
  quarterLabel: string,
  body: { taxYear: number; closeoutJson: Record<string, boolean> | null }
): Promise<{ ok: boolean; quarterlyWorkflow?: unknown; error?: string }> {
  const r = await fetch(`/api/accounting/pre-accounting/quarters/${encodeURIComponent(quarterLabel)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as { ok?: boolean; quarterlyWorkflow?: unknown; error?: string };
  if (r.status === 401) return { ok: false, error: "Unauthorized" };
  if (!r.ok) return { ok: false, error: data.error ?? "Update failed" };
  return { ok: true, quarterlyWorkflow: data.quarterlyWorkflow };
}

export type ReviewItemCreateBody = {
  taxYear: number;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  description?: string | null;
  severity?: string;
  status?: string;
  assignedRole?: string;
  dueAt?: string | null;
  resolutionNotes?: string | null;
};

export async function createPreAccountingReviewItem(
  body: ReviewItemCreateBody
): Promise<{ ok: boolean; reviewItem?: unknown; error?: string }> {
  const r = await fetch("/api/accounting/pre-accounting/review-items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as { ok?: boolean; reviewItem?: unknown; error?: string };
  if (r.status === 401) return { ok: false, error: "Unauthorized" };
  if (!r.ok) return { ok: false, error: data.error ?? "Create failed" };
  return { ok: true, reviewItem: data.reviewItem };
}

export async function patchPreAccountingReviewItem(
  id: number,
  body: Partial<{
    status: string;
    severity: string;
    assignedRole: string;
    resolutionNotes: string | null;
    dueAt: string | null;
    title: string;
    description: string | null;
  }>
): Promise<{ ok: boolean; reviewItem?: unknown; error?: string }> {
  const r = await fetch(`/api/accounting/pre-accounting/review-items/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as { ok?: boolean; reviewItem?: unknown; error?: string };
  if (r.status === 401) return { ok: false, error: "Unauthorized" };
  if (!r.ok) return { ok: false, error: data.error ?? "Update failed" };
  return { ok: true, reviewItem: data.reviewItem };
}

export async function patchFormCandidate(
  id: number,
  body: {
    reviewerStatus?: string;
    reviewerNotes?: string;
    supportGapStatus?: string;
    supportGapNote?: string | null;
    attachedDocumentIdsJson?: number[] | null;
  }
): Promise<{ ok: boolean; formCandidate?: unknown; error?: string }> {
  const r = await fetch(`/api/accounting/pre-accounting/form-candidates/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    formCandidate?: unknown;
    error?: string;
  };
  if (r.status === 401) return { ok: false, error: "Unauthorized" };
  if (!r.ok) return { ok: false, error: data.error ?? "Update failed" };
  return { ok: true, formCandidate: data.formCandidate };
}
